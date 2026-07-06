import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from django.utils import timezone

# Redis-backed waiting queue key
QUEUE_KEY = "voicechat:waiting_queue"


class SignalingConsumer(AsyncWebsocketConsumer):
    """
    Handles:
      - Matchmaking via a Redis list (FIFO queue)
      - WebRTC signaling relay (offer / answer / ICE candidates)
      - Call session logging to PostgreSQL
    """

    async def connect(self):
        await self.accept()
        self.room_group = None
        self.partner_channel = None
        self.call_session_id = None
        self.call_start_time = None
        self.user = self.scope.get("user")

        await self.send_json({"type": "connected", "user_id": str(self.user.id) if self.user and self.user.is_authenticated else None})
        await self.broadcast_stats()

    async def disconnect(self, close_code):
        await self._leave_room(notify_partner=True)
        await self._remove_from_queue()
        await self.broadcast_stats()

    # ------------------------------------------------------------------ #
    # Incoming messages from the React client                              #
    # ------------------------------------------------------------------ #
    async def receive(self, text_data):
        try:
            data = json.loads(text_data)
        except json.JSONDecodeError:
            return

        msg_type = data.get("type")

        if msg_type == "find_match":
            await self._find_match()
        elif msg_type == "skip":
            await self._leave_room(notify_partner=True)
            await self._find_match()
        elif msg_type == "leave":
            await self._leave_room(notify_partner=True)
            await self.send_json({"type": "idle"})
        elif msg_type in ("offer", "answer", "ice_candidate"):
            await self._relay_signal(data)
        elif msg_type == "end_call":
            await self._end_call()

    # ------------------------------------------------------------------ #
    # Matchmaking                                                          #
    # ------------------------------------------------------------------ #
    async def _find_match(self):
        """Try to dequeue a waiting partner; if none, enqueue self."""
        layer = self.channel_layer

        # Atomically pop from the Redis waiting list
        partner_channel = await layer.connection(0).__aenter__()
        try:
            partner_channel_name = await partner_channel.execute_command("LPOP", QUEUE_KEY)
        finally:
            await layer.connection(0).__aexit__(None, None, None)

        if partner_channel_name:
            partner_channel_name = partner_channel_name.decode()
            # Don't match with yourself (edge case on reconnect)
            if partner_channel_name == self.channel_name:
                await self._enqueue_self()
                return

            room = f"room_{min(self.channel_name, partner_channel_name)}_{max(self.channel_name, partner_channel_name)}"
            self.room_group = room
            self.partner_channel = partner_channel_name

            await layer.group_add(room, self.channel_name)
            await layer.group_add(room, partner_channel_name)

            # Log call session
            self.call_start_time = timezone.now()
            session = await self._create_call_session()
            self.call_session_id = str(session.id)

            await self.send_json({"type": "matched", "role": "caller", "room": room, "session_id": self.call_session_id})
            await layer.send(partner_channel_name, {
                "type": "partner_matched",
                "role": "callee",
                "room": room,
                "caller_channel": self.channel_name,
                "session_id": self.call_session_id,
            })
        else:
            await self._enqueue_self()
            await self.send_json({"type": "waiting"})

        await self.broadcast_stats()

    async def _enqueue_self(self):
        layer = self.channel_layer
        conn = await layer.connection(0).__aenter__()
        try:
            await conn.execute_command("RPUSH", QUEUE_KEY, self.channel_name)
        finally:
            await layer.connection(0).__aexit__(None, None, None)

    async def _remove_from_queue(self):
        layer = self.channel_layer
        conn = await layer.connection(0).__aenter__()
        try:
            await conn.execute_command("LREM", QUEUE_KEY, 0, self.channel_name)
        finally:
            await layer.connection(0).__aexit__(None, None, None)

    # ------------------------------------------------------------------ #
    # Room management                                                       #
    # ------------------------------------------------------------------ #
    async def _leave_room(self, notify_partner=False):
        if self.room_group:
            if notify_partner:
                await self.channel_layer.group_send(
                    self.room_group,
                    {"type": "partner_left", "leaver": self.channel_name},
                )
            await self.channel_layer.group_discard(self.room_group, self.channel_name)
            if self.call_session_id:
                await self._close_call_session()
            self.room_group = None
            self.partner_channel = None

    async def _end_call(self):
        await self._leave_room(notify_partner=True)
        await self.send_json({"type": "idle"})

    # ------------------------------------------------------------------ #
    # WebRTC signal relay                                                  #
    # ------------------------------------------------------------------ #
    async def _relay_signal(self, data):
        if not self.room_group:
            return
        await self.channel_layer.group_send(
            self.room_group,
            {"type": "signal_relay", "sender": self.channel_name, "payload": data},
        )

    # ------------------------------------------------------------------ #
    # Group message handlers (called by channel layer)                    #
    # ------------------------------------------------------------------ #
    async def partner_matched(self, event):
        self.room_group = event["room"]
        self.partner_channel = event["caller_channel"]
        self.call_session_id = event.get("session_id")
        self.call_start_time = timezone.now()
        await self.send_json({"type": "matched", "role": event["role"], "room": event["room"], "session_id": self.call_session_id})

    async def partner_left(self, event):
        if event.get("leaver") != self.channel_name:
            self.room_group = None
            self.partner_channel = None
            await self.send_json({"type": "partner_left"})

    async def signal_relay(self, event):
        if event.get("sender") != self.channel_name:
            await self.send_json(event["payload"])

    async def stats_broadcast(self, event):
        await self.send_json(event["data"])

    # ------------------------------------------------------------------ #
    # Database helpers (sync → async)                                     #
    # ------------------------------------------------------------------ #
    @database_sync_to_async
    def _create_call_session(self):
        from signaling.models import CallSession
        from django.contrib.auth import get_user_model
        User = get_user_model()
        user = self.user if self.user and self.user.is_authenticated else None
        return CallSession.objects.create(user_a=user)

    @database_sync_to_async
    def _close_call_session(self):
        from signaling.models import CallSession
        try:
            session = CallSession.objects.get(id=self.call_session_id)
            session.ended_at = timezone.now()
            if self.call_start_time:
                delta = session.ended_at - self.call_start_time
                session.duration_seconds = int(delta.total_seconds())
            session.save()
            # Update user stats
            if self.user and self.user.is_authenticated:
                self.user.total_calls += 1
                self.user.total_minutes += session.duration_seconds // 60
                self.user.save(update_fields=["total_calls", "total_minutes"])
        except CallSession.DoesNotExist:
            pass

    # ------------------------------------------------------------------ #
    # Helpers                                                              #
    # ------------------------------------------------------------------ #
    async def send_json(self, data):
        await self.send(text_data=json.dumps(data))

    async def broadcast_stats(self):
        from channels.layers import get_channel_layer
        layer = get_channel_layer()
        # Simple online count via Redis key TTL trick
        conn = await layer.connection(0).__aenter__()
        try:
            queue_len = await conn.execute_command("LLEN", QUEUE_KEY)
        finally:
            await layer.connection(0).__aexit__(None, None, None)

        await self.send_json({
            "type": "stats",
            "waiting": int(queue_len) if queue_len else 0,
        })

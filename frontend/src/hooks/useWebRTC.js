import { useRef, useState, useCallback, useEffect } from "react";

const ICE_SERVERS = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
  ],
};

export function useWebRTC({ onStatusChange, onStats }) {
  const wsRef = useRef(null);
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteAudioRef = useRef(null);

  const [status, setStatus] = useState("idle"); // idle | connecting | waiting | matched | incall
  const [isMuted, setIsMuted] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const timerRef = useRef(null);

  const updateStatus = useCallback((s) => {
    setStatus(s);
    onStatusChange?.(s);
  }, [onStatusChange]);

  // ── WebSocket ────────────────────────────────────────────────────────
  const connectWS = useCallback((token) => {
    const proto = location.protocol === "https:" ? "wss" : "ws";
    const url = `${proto}://${location.host}/ws/signal/${token ? `?token=${token}` : ""}`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => updateStatus("idle");

    ws.onmessage = async (e) => {
      const msg = JSON.parse(e.data);
      await handleSignal(msg);
    };

    ws.onclose = () => {
      cleanupCall();
      updateStatus("idle");
    };

    return ws;
  }, []);

  const send = (data) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(data));
    }
  };

  // ── Signal handler ───────────────────────────────────────────────────
  const handleSignal = useCallback(async (msg) => {
    switch (msg.type) {
      case "waiting":
        updateStatus("waiting");
        break;

      case "matched":
        updateStatus("matched");
        await setupPeerConnection();
        if (msg.role === "caller") {
          // Caller creates offer
          const offer = await pcRef.current.createOffer();
          await pcRef.current.setLocalDescription(offer);
          send({ type: "offer", sdp: offer });
        }
        break;

      case "offer":
        if (!pcRef.current) await setupPeerConnection();
        await pcRef.current.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        const answer = await pcRef.current.createAnswer();
        await pcRef.current.setLocalDescription(answer);
        send({ type: "answer", sdp: answer });
        startCallTimer();
        updateStatus("incall");
        break;

      case "answer":
        await pcRef.current?.setRemoteDescription(new RTCSessionDescription(msg.sdp));
        startCallTimer();
        updateStatus("incall");
        break;

      case "ice_candidate":
        if (msg.candidate) {
          try {
            await pcRef.current?.addIceCandidate(new RTCIceCandidate(msg.candidate));
          } catch {}
        }
        break;

      case "partner_left":
        cleanupCall(false);
        updateStatus("idle");
        break;

      case "idle":
        cleanupCall(false);
        updateStatus("idle");
        break;

      case "stats":
        onStats?.(msg);
        break;

      default:
        break;
    }
  }, []);

  // ── PeerConnection ───────────────────────────────────────────────────
  const setupPeerConnection = async () => {
    cleanupPC();

    const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    localStreamRef.current = stream;

    const pc = new RTCPeerConnection(ICE_SERVERS);
    pcRef.current = pc;

    stream.getTracks().forEach((t) => pc.addTrack(t, stream));

    pc.onicecandidate = ({ candidate }) => {
      if (candidate) send({ type: "ice_candidate", candidate });
    };

    pc.ontrack = (e) => {
      if (remoteAudioRef.current) {
        remoteAudioRef.current.srcObject = e.streams[0];
        remoteAudioRef.current.play().catch(() => {});
      }
    };

    pc.onconnectionstatechange = () => {
      if (["disconnected", "failed", "closed"].includes(pc.connectionState)) {
        cleanupCall(false);
        updateStatus("idle");
      }
    };

    return pc;
  };

  // ── Controls ─────────────────────────────────────────────────────────
  const findMatch = () => {
    updateStatus("connecting");
    send({ type: "find_match" });
  };

  const skip = () => {
    cleanupCall(false);
    send({ type: "skip" });
    updateStatus("waiting");
  };

  const leave = () => {
    send({ type: "leave" });
    cleanupCall(false);
    updateStatus("idle");
  };

  const toggleMute = () => {
    const tracks = localStreamRef.current?.getAudioTracks();
    if (tracks) {
      tracks.forEach((t) => (t.enabled = !t.enabled));
      setIsMuted((m) => !m);
    }
  };

  // ── Cleanup ──────────────────────────────────────────────────────────
  const cleanupPC = () => {
    pcRef.current?.close();
    pcRef.current = null;
    localStreamRef.current?.getTracks().forEach((t) => t.stop());
    localStreamRef.current = null;
    if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
  };

  const cleanupCall = (sendLeave = true) => {
    if (sendLeave) send({ type: "leave" });
    cleanupPC();
    stopCallTimer();
    setCallDuration(0);
    setIsMuted(false);
  };

  // ── Timer ────────────────────────────────────────────────────────────
  const startCallTimer = () => {
    stopCallTimer();
    const start = Date.now();
    timerRef.current = setInterval(() => {
      setCallDuration(Math.floor((Date.now() - start) / 1000));
    }, 1000);
  };

  const stopCallTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => () => {
    cleanupCall();
    wsRef.current?.close();
  }, []);

  return {
    connectWS,
    findMatch,
    skip,
    leave,
    toggleMute,
    isMuted,
    status,
    callDuration,
    remoteAudioRef,
  };
}

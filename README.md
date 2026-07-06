# AirVoice — Random Voice Chat Platform

A full-stack web app that connects random people worldwide for 1-on-1 voice calls, built with **Django Channels** (WebSocket signaling + matchmaking), **PostgreSQL**, **Redis**, **React**, and **WebRTC** for peer-to-peer audio.

## Architecture

```
┌─────────────┐         WebSocket (signaling)        ┌──────────────────┐
│   React UI  │ ◄───────────────────────────────────► │  Django Channels  │
│  (Vite)     │                                        │   (Daphne ASGI)   │
└──────┬──────┘                                        └─────────┬────────┘
       │                                                          │
       │         WebRTC P2P audio (after handshake)               │ Redis (queue +
       └─────────────────────────────────────────────────────────►│  channel layer)
                                                                    │
                                                          PostgreSQL (users,
                                                           call history)
```

- **Matchmaking**: a Redis-backed FIFO queue. When two users want a call, the server pairs them and tells one to be the WebRTC "caller" and the other the "callee".
- **Signaling**: Django Channels relays SDP offers/answers and ICE candidates between the two browsers over WebSocket — the server never sees or touches the actual audio.
- **Media**: once the WebRTC handshake completes, audio flows **directly between browsers** (peer-to-peer), so the server has near-zero bandwidth cost for calls.
- **Persistence**: PostgreSQL stores users and a `CallSession` log (start/end time, duration) for the profile page's call history.

## Tech Stack

| Layer | Tech |
|---|---|
| Backend framework | Django 4.2 + Django REST Framework |
| Real-time | Django Channels 4 + Daphne (ASGI) |
| Pub/Sub & Queue | Redis (channel layer + matchmaking queue) |
| Database | PostgreSQL |
| Auth | JWT (SimpleJWT) — used for both REST and WebSocket auth |
| Frontend | React 18 + Vite + React Router |
| Voice | WebRTC (native browser API, STUN servers) |

## Setup

### Prerequisites
- Python 3.10+
- Node.js 18+
- PostgreSQL running locally
- Redis running locally (`redis-server`)

### 1. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt

cp .env.example .env       # edit DB credentials if needed

# Create the database
createdb voicechat

python manage.py migrate
python manage.py createsuperuser   # optional, for /admin

# Run with Daphne (ASGI server — required for WebSockets)
python manage.py runserver
```

The backend serves:
- REST API at `http://localhost:8000/api/`
- WebSocket signaling at `ws://localhost:8000/ws/signal/`
- Admin at `http://localhost:8000/admin/`

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Visit `http://localhost:5173`. Vite proxies `/api` and `/ws` to the Django backend automatically.

## Key Features

- **JWT auth** — register/login, tokens stored client-side, auto-refresh on expiry
- **Redis-based matchmaking queue** — atomic LPOP/RPUSH ensures no double-matching
- **WebRTC signaling relay** via Channels groups (one Redis-backed "room" per call)
- **Call session logging** — every call is saved to Postgres with duration, surfaced on the Profile page
- **Mute / Skip / End call** controls
- **Live waiting-queue count** shown to the user
- **Mobile-responsive UI**

## Project Structure

```
backend/
  voicechat/        # Django project settings, ASGI/URL config
  users/             # Custom User model, JWT auth endpoints
  signaling/         # WebSocket consumer (matchmaking + WebRTC relay), CallSession model
frontend/
  src/
    pages/           # Landing, Login, Register, Chat, Profile
    hooks/           # useAuth, useWebRTC (core WebRTC logic)
    utils/api.js      # Axios instance with JWT interceptor
```

## Notes for Production

- Add a **TURN server** (e.g. coturn or a paid service like Twilio/Metered) — STUN alone isn't enough when both users are behind restrictive NATs/firewalls (~10-20% of real-world connections need TURN relay).
- Put Daphne behind Nginx and run it via a process manager (systemd/Supervisor).
- Set `DEBUG=False`, a real `SECRET_KEY`, and proper `ALLOWED_HOSTS` in `.env`.
- Consider adding rate limiting on `/api/users/register/` and abuse reporting/blocking for the matchmaking pool.

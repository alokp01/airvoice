import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useWebRTC } from "../hooks/useWebRTC";
import "./ChatPage.css";

function formatTime(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, "0");
  const s = String(secs % 60).padStart(2, "0");
  return `${m}:${s}`;
}

const STATUS_LABEL = {
  idle: "Ready to connect",
  connecting: "Connecting…",
  waiting: "Finding someone to talk to…",
  matched: "Connecting call…",
  incall: "In call",
};

export default function ChatPage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ waiting: 0 });
  const [partnerLeft, setPartnerLeft] = useState(false);
  const audioRef = useRef(null);

  const { connectWS, findMatch, skip, leave, toggleMute, isMuted, status, callDuration, remoteAudioRef } =
    useWebRTC({
      onStatusChange: (s) => {
        if (s === "idle") setPartnerLeft(false);
      },
      onStats: setStats,
    });

  useEffect(() => {
    remoteAudioRef.current = audioRef.current;
    const token = localStorage.getItem("access_token");
    connectWS(token);
  }, []);

  const handleLogout = () => {
    leave();
    logout();
    navigate("/");
  };

  const isInCall = status === "incall";
  const isWaiting = status === "waiting";
  const isIdle = status === "idle";

  return (
    <div className="chat-page">
      {/* Hidden audio element for remote stream */}
      <audio ref={audioRef} autoPlay playsInline />

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-logo">🎙 AirVoice</div>

        <div className="sidebar-user">
          <div className="avatar">{(user?.display_name || user?.username || "?")[0].toUpperCase()}</div>
          <div>
            <div className="sidebar-name">{user?.display_name || user?.username}</div>
            {user?.country && <div className="sidebar-country">🌍 {user.country}</div>}
          </div>
        </div>

        <div className="sidebar-stats">
          <div className="stat-row">
            <span>Your calls</span>
            <strong>{user?.total_calls ?? 0}</strong>
          </div>
          <div className="stat-row">
            <span>Minutes talked</span>
            <strong>{user?.total_minutes ?? 0}</strong>
          </div>
          <div className="stat-row">
            <span>Waiting now</span>
            <strong>{stats.waiting}</strong>
          </div>
        </div>

        <div className="sidebar-actions">
          <button className="btn-ghost sidebar-btn" onClick={() => navigate("/profile")}>⚙ Profile</button>
          <button className="btn-ghost sidebar-btn" onClick={handleLogout}>↩ Log out</button>
        </div>
      </aside>

      {/* Main */}
      <main className="chat-main">
        {/* Status bar */}
        <div className="status-bar">
          <div className={`status-dot ${status}`} />
          <span>{STATUS_LABEL[status] || status}</span>
          {isInCall && (
            <span className="call-timer">{formatTime(callDuration)}</span>
          )}
        </div>

        {/* Center card */}
        <div className="chat-center">
          {isIdle && !partnerLeft && (
            <div className="idle-state">
              <div className="orb idle-orb" />
              <h2>Ready to talk?</h2>
              <p>Press start to be matched with a random person worldwide.</p>
              <button className="btn-primary big-btn" onClick={findMatch}>
                🎙 Start Talking
              </button>
            </div>
          )}

          {isIdle && partnerLeft && (
            <div className="idle-state">
              <div className="orb disconnected-orb" />
              <h2>Call ended</h2>
              <p>Your partner disconnected. Want to find someone new?</p>
              <button className="btn-primary big-btn" onClick={findMatch}>
                Find Next Person
              </button>
            </div>
          )}

          {isWaiting && (
            <div className="waiting-state">
              <div className="orb pulse-orb" />
              <h2>Looking for someone…</h2>
              <p>{stats.waiting > 1 ? `${stats.waiting} people waiting` : "You're at the front of the queue"}</p>
              <button className="btn-ghost" onClick={leave}>Cancel</button>
            </div>
          )}

          {status === "matched" && (
            <div className="waiting-state">
              <div className="orb pulse-orb green" />
              <h2>Match found!</h2>
              <p>Setting up secure voice connection…</p>
            </div>
          )}

          {isInCall && (
            <div className="incall-state">
              <div className={`orb call-orb ${isMuted ? "muted" : "active"}`} />
              <h2>Connected</h2>
              <p className="call-hint">
                {isMuted ? "🔇 You are muted" : "🎙 You are live — speak up!"}
              </p>
              <div className="call-controls">
                <button
                  className={`ctrl-btn ${isMuted ? "muted" : ""}`}
                  onClick={toggleMute}
                  title={isMuted ? "Unmute" : "Mute"}
                >
                  {isMuted ? "🔇" : "🎙"}
                  <span>{isMuted ? "Unmute" : "Mute"}</span>
                </button>
                <button className="ctrl-btn skip" onClick={skip} title="Skip to next person">
                  ⏭
                  <span>Skip</span>
                </button>
                <button className="ctrl-btn end" onClick={leave} title="End call">
                  📵
                  <span>End</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

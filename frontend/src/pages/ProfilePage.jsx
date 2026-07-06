import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import api from "../utils/api";
import "./ProfilePage.css";

export default function ProfilePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ display_name: "", country: "" });
  const [history, setHistory] = useState([]);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) setForm({ display_name: user.display_name || "", country: user.country || "" });
    api.get("/signaling/history/").then((r) => setHistory(r.data)).catch(() => {});
  }, [user]);

  const handleSave = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      await api.patch("/users/profile/", form);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (secs) => {
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  return (
    <div className="profile-page">
      <header className="profile-header">
        <button className="btn-ghost back-btn" onClick={() => navigate("/chat")}>← Back to Chat</button>
        <span className="logo">🎙 AirVoice</span>
        <button className="btn-ghost" onClick={() => { logout(); navigate("/"); }}>Log out</button>
      </header>

      <div className="profile-body">
        {/* Left — edit profile */}
        <section className="profile-card">
          <div className="profile-avatar">{(user?.display_name || user?.username || "?")[0].toUpperCase()}</div>
          <h2>{user?.username}</h2>
          <p className="profile-email">{user?.email}</p>

          <div className="profile-stats">
            <div className="pstat">
              <strong>{user?.total_calls ?? 0}</strong>
              <span>Total Calls</span>
            </div>
            <div className="pstat">
              <strong>{user?.total_minutes ?? 0}</strong>
              <span>Minutes Talked</span>
            </div>
          </div>

          <form className="profile-form" onSubmit={handleSave}>
            <div className="field">
              <label>Display Name</label>
              <input
                type="text"
                value={form.display_name}
                onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                placeholder="How you appear to others"
              />
            </div>
            <div className="field">
              <label>Country</label>
              <input
                type="text"
                value={form.country}
                onChange={(e) => setForm({ ...form, country: e.target.value })}
                placeholder="e.g. India"
              />
            </div>
            <button className="btn-primary" type="submit" disabled={loading}>
              {saved ? "✓ Saved!" : loading ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </section>

        {/* Right — call history */}
        <section className="history-card">
          <h3>Recent Calls</h3>
          {history.length === 0 ? (
            <p className="no-history">No calls yet — go start talking!</p>
          ) : (
            <ul className="history-list">
              {history.map((c) => (
                <li key={c.id} className="history-item">
                  <span className="history-icon">📞</span>
                  <div>
                    <div className="history-date">
                      {new Date(c.started_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </div>
                    <div className="history-dur">Duration: {formatDuration(c.duration_seconds)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

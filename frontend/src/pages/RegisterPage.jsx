import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import "./AuthPage.css";

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    username: "", email: "", password: "", display_name: "", country: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await register(form);
      navigate("/chat");
    } catch (err) {
      const data = err.response?.data;
      const msg = data
        ? Object.values(data).flat().join(" ")
        : "Registration failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">🎙 AirVoice</Link>
        <h1 className="auth-title">Create your account</h1>
        <p className="auth-sub">Free forever. No credit card needed.</p>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="field-row">
            <div className="field">
              <label>Username *</label>
              <input type="text" placeholder="coolperson42" value={form.username} onChange={set("username")} required />
            </div>
            <div className="field">
              <label>Display Name</label>
              <input type="text" placeholder="Alex" value={form.display_name} onChange={set("display_name")} />
            </div>
          </div>
          <div className="field">
            <label>Email *</label>
            <input type="email" placeholder="you@example.com" value={form.email} onChange={set("email")} required />
          </div>
          <div className="field-row">
            <div className="field">
              <label>Password *</label>
              <input type="password" placeholder="min 8 chars" value={form.password} onChange={set("password")} required />
            </div>
            <div className="field">
              <label>Country</label>
              <input type="text" placeholder="India" value={form.country} onChange={set("country")} />
            </div>
          </div>
          <button className="btn-primary auth-btn" type="submit" disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </button>
        </form>

        <p className="auth-switch">
          Already have an account? <Link to="/login">Log in</Link>
        </p>
      </div>
    </div>
  );
}

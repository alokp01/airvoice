import { useNavigate } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import "./LandingPage.css";

export default function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuth();

  return (
    <div className="landing">
      <nav className="landing-nav">
        <span className="logo">🎙 AirVoice</span>
        <div className="nav-links">
          {user ? (
            <>
              <button className="btn-ghost" onClick={() => navigate("/profile")}>Profile</button>
              <button className="btn-primary" onClick={() => navigate("/chat")}>Start Talking</button>
            </>
          ) : (
            <>
              <button className="btn-ghost" onClick={() => navigate("/login")}>Log In</button>
              <button className="btn-primary" onClick={() => navigate("/register")}>Sign Up Free</button>
            </>
          )}
        </div>
      </nav>

      <main className="landing-hero">
        <div className="hero-badge">🌍 Real-time voice chat</div>
        <h1 className="hero-title">
          Talk to someone<br />
          <span className="gradient-text">anywhere on Earth</span>
        </h1>
        <p className="hero-sub">
          Connect instantly with a random person worldwide.<br />
          No cameras. No distractions. Just voices.
        </p>
        <div className="hero-actions">
          <button className="btn-primary hero-cta" onClick={() => navigate(user ? "/chat" : "/register")}>
            Start a Conversation →
          </button>
          {!user && (
            <button className="btn-ghost" onClick={() => navigate("/login")}>
              Already have an account
            </button>
          )}
        </div>
      </main>

      <section className="features">
        <div className="feature-card">
          <span className="feature-icon">⚡</span>
          <h3>Instant Match</h3>
          <p>Get connected with a real person in seconds, no waiting rooms.</p>
        </div>
        <div className="feature-card">
          <span className="feature-icon">🔒</span>
          <h3>Anonymous by Default</h3>
          <p>No real name needed. Just pick a display name and start talking.</p>
        </div>
        <div className="feature-card">
          <span className="feature-icon">🌐</span>
          <h3>Crystal Clear Audio</h3>
          <p>Peer-to-peer WebRTC voice — no middleman, minimal latency.</p>
        </div>
        <div className="feature-card">
          <span className="feature-icon">⏭</span>
          <h3>Skip Anytime</h3>
          <p>Not feeling the vibe? Skip to the next person instantly.</p>
        </div>
      </section>

      <footer className="landing-footer">
        <p>Built with Django · Django Channels · React · WebRTC</p>
      </footer>
    </div>
  );
}

import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";

const JAAS_APP_ID = import.meta.env.VITE_JAAS_APP_ID || "";

const Icon = ({ d, size = 18, stroke = "currentColor" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={stroke}
    strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const I = {
  video: "M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z",
  user:  "M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z",
  lock:  "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
  eye:   "M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zM12 9a3 3 0 100 6 3 3 0 000-6z",
};

export default function GuestJoin() {
  const { roomId } = useParams();
  const [name, setName]               = useState("");
  const [password, setPassword]       = useState("");
  const [autoFilled, setAutoFilled]   = useState(false);
  const [showPw, setShowPw]           = useState(false);
  const [joining, setJoining]         = useState(false);
  const [meetingUrl, setMeetingUrl]   = useState(null);
  const [error, setError]             = useState(null);
  const nameRef = useRef(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) { setPassword(decodeURIComponent(hash)); setAutoFilled(true); }
    nameRef.current?.focus();
  }, []);

  const handleJoin = async (e) => {
    e?.preventDefault();
    if (!name.trim()) return;
    setJoining(true);
    setError(null);
    try {
      const params = new URLSearchParams({ room: roomId, name: name.trim() });
      if (password) params.set("password", password);
      const res = await fetch(`/api/token?${params}`);
      if (!res.ok) throw new Error("server error");
      const { token, error: err } = await res.json();
      if (err) throw new Error(err);
      setMeetingUrl(`https://8x8.vc/${JAAS_APP_ID}/${roomId}#jwt=${token}`);
    } catch {
      setError("Couldn't connect to the meeting. Please try again.");
      setJoining(false);
    }
  };

  // ── Full-screen meeting iframe ────────────────────────────────────────────
  if (meetingUrl) {
    return (
      <div style={{ width: "100vw", height: "100vh", background: "#000" }}>
        <iframe
          src={meetingUrl}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          style={{ width: "100%", height: "100%", border: "none" }}
          title="Meeting"
        />
      </div>
    );
  }

  // ── Join page ─────────────────────────────────────────────────────────────
  const displayRoom = roomId.startsWith("mh-") ? roomId.slice(3) : roomId;

  return (
    <div style={{
      minHeight: "100vh",
      background: "radial-gradient(ellipse at 50% 0%, #0f172a 0%, #0b0f19 65%)",
      display: "flex", flexDirection: "column",
      alignItems: "center", justifyContent: "center",
      fontFamily: "'DM Sans','Segoe UI',sans-serif", color: "#e2e8f0",
      padding: "24px",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        input{outline:none;}
        .gi:focus{border-color:#38bdf8!important;box-shadow:0 0 0 3px rgba(56,189,248,.08)!important;}
        .jbtn{transition:all .2s;}
        .jbtn:hover:not(:disabled){filter:brightness(1.1);transform:translateY(-1px);}
        @keyframes fadeUp{from{opacity:0;transform:translateY(20px)}to{opacity:1;transform:translateY(0)}}
        .fu{animation:fadeUp .4s ease forwards;}
        @keyframes spin{to{transform:rotate(360deg)}}
        .spin{animation:spin .8s linear infinite;display:inline-block;}
      `}</style>

      <div className="fu" style={{ width: "100%", maxWidth: 420 }}>

        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 36 }}>
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 14px",
            boxShadow: "0 12px 40px rgba(14,165,233,.35)",
          }}>
            <Icon d={I.video} size={24} stroke="#fff" />
          </div>
          <div style={{ fontFamily: "Syne", fontWeight: 800, fontSize: 22, letterSpacing: ".3px" }}>MeetHub</div>
          <p style={{ color: "#64748b", fontSize: 13, marginTop: 4 }}>You've been invited to a meeting</p>
        </div>

        {/* Card */}
        <div style={{
          background: "#111827", border: "1px solid #1e293b",
          borderRadius: 20, padding: "32px 28px",
          boxShadow: "0 32px 80px rgba(0,0,0,.5)",
        }}>
          {/* Room badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            background: "rgba(56,189,248,.07)", border: "1px solid rgba(56,189,248,.18)",
            borderRadius: 10, padding: "9px 14px", marginBottom: 28,
          }}>
            <Icon d={I.video} size={14} stroke="#38bdf8" />
            <span style={{ fontSize: 11, color: "#475569", fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em" }}>Room</span>
            <code style={{ fontSize: 13, color: "#38bdf8", fontFamily: "monospace", letterSpacing: ".04em", wordBreak: "break-all" }}>
              {displayRoom}
            </code>
          </div>

          <form onSubmit={handleJoin}>
            {/* Name */}
            <FieldLabel>Your name</FieldLabel>
            <div style={{ position: "relative", marginBottom: 16 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#475569", pointerEvents: "none" }}>
                <Icon d={I.user} size={15} />
              </span>
              <input
                ref={nameRef}
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Enter your name"
                required
                className="gi"
                style={inputStyle("#1e293b")}
              />
            </div>

            {/* Password */}
            <FieldLabel optional>Meeting password</FieldLabel>
            <div style={{ position: "relative", marginBottom: 28 }}>
              <span style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: autoFilled ? "#38bdf8" : "#475569", pointerEvents: "none" }}>
                <Icon d={I.lock} size={15} stroke={autoFilled ? "#38bdf8" : "currentColor"} />
              </span>
              <input
                value={password}
                onChange={e => { setPassword(e.target.value); setAutoFilled(false); }}
                type={showPw ? "text" : "password"}
                placeholder="Password (if required)"
                className="gi"
                style={inputStyle(autoFilled ? "rgba(56,189,248,.35)" : "#1e293b")}
              />
              <button
                type="button"
                onClick={() => setShowPw(v => !v)}
                style={{ position: "absolute", right: 12, top: "50%", transform: "translateY(-50%)", color: "#475569", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                <Icon d={I.eye} size={15} />
              </button>
              {autoFilled && (
                <span style={{ position: "absolute", right: 36, top: "50%", transform: "translateY(-50%)", fontSize: 10, color: "#38bdf8", fontWeight: 600, letterSpacing: ".04em" }}>
                  AUTO-FILLED
                </span>
              )}
            </div>

            {error && (
              <div style={{
                background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)",
                borderRadius: 9, padding: "10px 14px", fontSize: 13, color: "#fca5a5", marginBottom: 16,
              }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={joining || !name.trim()}
              className="jbtn"
              style={{
                width: "100%",
                background: !name.trim() ? "#1e293b" : "linear-gradient(135deg,#0ea5e9,#6366f1)",
                color: !name.trim() ? "#475569" : "#fff",
                border: "none", borderRadius: 12, padding: "13px 0",
                fontSize: 15, fontWeight: 600,
                cursor: joining || !name.trim() ? "not-allowed" : "pointer",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
              }}>
              {joining
                ? <><span className="spin" style={{ fontSize: 16 }}>◌</span> Connecting…</>
                : <><Icon d={I.video} size={17} stroke={!name.trim() ? "#475569" : "#fff"} /> Join Meeting</>
              }
            </button>
          </form>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#1e293b", marginTop: 24 }}>
          Powered by MeetHub · Jitsi as a Service
        </p>
      </div>
    </div>
  );
}

function FieldLabel({ children, optional }) {
  return (
    <label style={{
      fontSize: 11, fontWeight: 600, color: "#64748b",
      textTransform: "uppercase", letterSpacing: ".07em",
      display: "block", marginBottom: 7,
    }}>
      {children}
      {optional && <span style={{ fontWeight: 400, textTransform: "none", color: "#334155", marginLeft: 6 }}>— optional</span>}
    </label>
  );
}

const inputStyle = (borderColor) => ({
  width: "100%", background: "#0b0f19",
  border: `1px solid ${borderColor}`,
  borderRadius: 10, padding: "10px 38px",
  color: "#e2e8f0", fontSize: 14,
  transition: "border-color .15s, box-shadow .15s",
  display: "block",
});

import { useState, useEffect, useCallback, useRef } from "react";

// ─── Server Config ────────────────────────────────────────────────────────────
const JAAS_APP_ID = import.meta.env.VITE_JAAS_APP_ID || "";
const meetUrl = (room) => `https://8x8.vc/${JAAS_APP_ID}/${room}`;

const THEME = {
  bg:          "#ffffff",
  bgSurface:   "#f8faf8",
  bgInput:     "#f8faf8",
  bgCard:      "#ffffff",
  border:      "#d0e8d8",
  borderCard:  "#e4ede4",
  primary:     "#0F6E56",
  primaryText: "#ffffff",
  textMain:    "#1a2e1a",
  textMuted:   "#4a6741",
  textHint:    "#7a9e7a",
  tabActive:   "rgba(15,110,86,.12)",
  tabActiveText: "#0F6E56",
  ghostBg:     "#f4faf7",
  ghostBorder: "#c8e6d8",
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
const CHARS = "abcdefghijklmnopqrstuvwxyz0123456789";
const randomRoom = () => {
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  return "mh-" + Array.from(bytes, b => CHARS[b % CHARS.length]).join("");
};

const fmt = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" }) + " · " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};
const timeUntil = (iso) => {
  const diff = new Date(iso) - Date.now();
  if (diff < 0) return "now";
  const m = Math.floor(diff / 60000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `in ${h}h`;
  return `in ${Math.floor(h / 24)}d`;
};

// ─── Calendar Helpers ─────────────────────────────────────────────────────────
const toCalDate = (iso) => new Date(iso).toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
const googleCalUrl = (m) => {
  const s = toCalDate(m.time), e = toCalDate(new Date(new Date(m.time).getTime() + 3600000).toISOString());
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(m.title)}&dates=${s}/${e}&details=${encodeURIComponent(`Join at ${meetUrl(m.room)}\n\n${m.notes || ""}`)}&location=${encodeURIComponent(meetUrl(m.room))}`;
};
const outlookCalUrl = (m) => {
  const s = new Date(m.time).toISOString(), e = new Date(new Date(m.time).getTime() + 3600000).toISOString();
  return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(m.title)}&startdt=${s}&enddt=${e}&body=${encodeURIComponent(`Join at ${meetUrl(m.room)}\n\n${m.notes || ""}`)}&location=${encodeURIComponent(meetUrl(m.room))}`;
};
const downloadIcs = (m) => {
  const s = toCalDate(m.time), e = toCalDate(new Date(new Date(m.time).getTime() + 3600000).toISOString());
  const content = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MeetHub//EN", "BEGIN:VEVENT",
    `DTSTART:${s}`, `DTEND:${e}`, `SUMMARY:${m.title}`,
    `DESCRIPTION:Join at ${meetUrl(m.room)}\\n\\n${m.notes || ""}`,
    `LOCATION:${meetUrl(m.room)}`, `UID:${m.id}@meethub`,
    "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const blob = new Blob([content], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = `${m.title.replace(/\s+/g, "-")}.ics`; a.click();
  URL.revokeObjectURL(url);
};

// ─── Storage ──────────────────────────────────────────────────────────────────
const store = {
  async get(k) { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } },
  async set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ─── Recurring / frequency config ─────────────────────────────────────────────
const FREQ_LABELS  = { daily: "Daily", weekly: "Weekly", biweekly: "Bi-weekly", monthly: "Monthly", custom: "Custom" };
const FREQ_COLORS  = { daily: "rgba(16,185,129,.12)", weekly: "rgba(56,189,248,.12)", biweekly: "rgba(139,92,246,.12)", monthly: "rgba(245,158,11,.12)", custom: "rgba(236,72,153,.12)" };
const FREQ_BORDERS = { daily: "rgba(16,185,129,.3)", weekly: "rgba(56,189,248,.3)", biweekly: "rgba(139,92,246,.3)", monthly: "rgba(245,158,11,.3)", custom: "rgba(236,72,153,.3)" };
const FREQ_TEXT    = { daily: "#34d399", weekly: "#38bdf8", biweekly: "#a78bfa", monthly: "#fbbf24", custom: "#f472b6" };
const AVATAR_COLORS = ["#0ea5e9", "#6366f1", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#ef4444", "#14b8a6"];
const initials    = (name) => name.split(/\s+/).map(w => w[0]).join("").toUpperCase().slice(0, 2);
const avatarColor = (i) => AVATAR_COLORS[i % AVATAR_COLORS.length];

// ─── Icon ─────────────────────────────────────────────────────────────────────
const Icon = ({ d, size = 18, stroke = "currentColor", fill = "none" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d} />
  </svg>
);
const ICONS = {
  video:    "M15 10l4.553-2.069A1 1 0 0121 8.82v6.36a1 1 0 01-1.447.89L15 14M3 8a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V8z",
  calendar: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 012 2v14a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2z",
  bookmark: "M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2z",
  plus:     "M12 5v14M5 12h14",
  trash:    "M3 6h18M8 6V4h8v2M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6",
  copy:     "M8 4H6a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2v-2M16 4h2a2 2 0 012 2v12M11 4h4v4h-4z",
  x:        "M18 6L6 18M6 6l12 12",
  link:     "M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71",
  arrow:    "M5 12h14M12 5l7 7-7 7",
  clock:    "M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10zM12 6v6l4 2",
  repeat:   "M17 2l4 4-4 4M3 11V9a4 4 0 014-4h14M7 22l-4-4 4-4M21 13v2a4 4 0 01-4 4H3",
  share:    "M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13",
  lock:     "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z",
};

// ─── App ──────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab]             = useState("quick");
  const [activeCall, setActiveCall] = useState(null);
  const [savedRooms, setSavedRooms] = useState([]);
  const [meetings, setMeetings]   = useState([]);
  const [recurring, setRecurring] = useState([]);
  const [toast, setToast]         = useState(null);
  const [joining, setJoining]     = useState(false);
  const iframeRef = useRef(null);

  useEffect(() => {
    (async () => {
      const s = await store.get("jitsi:saved");     if (s) setSavedRooms(s);
      const m = await store.get("jitsi:meetings");  if (m) setMeetings(m);
      const r = await store.get("jitsi:recurring"); if (r) setRecurring(r);
    })();
  }, []);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const joinMeeting = async (room, title, displayName) => {
    const normalRoom = room.trim().replace(/\s+/g, "-").toLowerCase();
    setJoining(true);
    try {
      const params = new URLSearchParams({ room: normalRoom, name: displayName || title || "Guest" });
      const res = await fetch(`/api/token?${params}`);
      if (!res.ok) throw new Error("token request failed");
      const { token, error } = await res.json();
      if (error) throw new Error(error);
      setActiveCall({ room: normalRoom, title: title || room, token });
      setTab("call");
    } catch {
      showToast("Could not get meeting token — check JaaS env vars", "error");
    } finally {
      setJoining(false);
    }
  };
  const endCall = () => { setActiveCall(null); setTab("quick"); };

  const saveRoom = useCallback(async (room, label) => {
    const next = [{ id: Date.now(), room, label: label || room }, ...savedRooms].slice(0, 20);
    setSavedRooms(next); await store.set("jitsi:saved", next); showToast("Room saved!");
  }, [savedRooms]);

  const deleteRoom = useCallback(async (id) => {
    const next = savedRooms.filter(r => r.id !== id);
    setSavedRooms(next); await store.set("jitsi:saved", next);
  }, [savedRooms]);

  const addMeeting = useCallback(async (m) => {
    const next = [m, ...meetings].sort((a, b) => new Date(a.time) - new Date(b.time)).slice(0, 50);
    setMeetings(next); await store.set("jitsi:meetings", next); showToast("Meeting scheduled!");
  }, [meetings]);

  const deleteMeeting = useCallback(async (id) => {
    const next = meetings.filter(m => m.id !== id);
    setMeetings(next); await store.set("jitsi:meetings", next);
  }, [meetings]);

  const addRecurring = useCallback(async (r) => {
    const next = [r, ...recurring];
    setRecurring(next); await store.set("jitsi:recurring", next); showToast("Recurring meeting created!");
  }, [recurring]);

  const deleteRecurring = useCallback(async (id) => {
    const next = recurring.filter(r => r.id !== id);
    setRecurring(next); await store.set("jitsi:recurring", next);
  }, [recurring]);

  // Copies a /join/ invite link with optional password in the hash
  const copyLink = (room, password) => {
    const base = `${window.location.origin}/join/${room}`;
    const url = password ? `${base}#${encodeURIComponent(password)}` : base;
    navigator.clipboard.writeText(url).then(() => showToast("Invite link copied!"));
  };

  const shareRecurring = (room, title, password) => {
    const base = `${window.location.origin}/join/${room}`;
    const url = password ? `${base}#${encodeURIComponent(password)}` : base;
    if (navigator.share) {
      navigator.share({ title: `Join ${title}`, text: `Join me on MeetHub: ${title}`, url })
        .catch(() => navigator.clipboard.writeText(url).then(() => showToast("Invite link copied!")));
    } else {
      navigator.clipboard.writeText(url).then(() => showToast("Invite link copied!"));
    }
  };

  const upcoming = meetings.filter(m => new Date(m.time) > Date.now() - 300000).sort((a, b) => new Date(a.time) - new Date(b.time));
  const past     = meetings.filter(m => new Date(m.time) <= Date.now() - 300000);

  return (
    <div style={{ minHeight: "100vh", background: THEME.bg, fontFamily: "'DM Sans','Segoe UI',sans-serif", color: THEME.textMain, display: "flex", flexDirection: "column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        ::-webkit-scrollbar{width:4px;} ::-webkit-scrollbar-thumb{background:#334155;border-radius:4px;}
        input,textarea{outline:none;} button{cursor:pointer;border:none;background:none;}
        .tab-btn:hover{background:rgba(56,189,248,.08)!important;}
        .action-btn{transition:all .18s;} .action-btn:hover{transform:translateY(-1px);filter:brightness(1.12);}
        .card{transition:box-shadow .2s;} .card:hover{box-shadow:0 4px 32px rgba(56,189,248,.07)!important;}
        .rec-card:hover{box-shadow:0 0 0 1px rgba(56,189,248,.3)!important;}
        .ico-btn:hover{background:rgba(255,255,255,.09)!important;}
        .cal-opt:hover{background:rgba(255,255,255,.06)!important;}
        body{background:${THEME.bg};}
        .freq-pill{padding:5px 12px;border-radius:6px;font-size:12px;border:1px solid ${THEME.borderCard};color:${THEME.textMuted};background:transparent;cursor:pointer;transition:all .15s;}
        .freq-pill.active{background:${THEME.tabActive};border-color:rgba(56,189,248,.4);color:${THEME.tabActiveText};}
        @keyframes fadeUp{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
        @keyframes toastIn{from{opacity:0;transform:translateX(24px)}to{opacity:1;transform:translateX(0)}}
        .fade-up{animation:fadeUp .32s ease forwards;}
        .pulse{animation:pulse 2s infinite;} @keyframes pulse{0%,100%{opacity:1}50%{opacity:.5}}
      `}</style>

      {toast && (
        <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999,
          background: toast.type === "success" ? "#0f766e" : "#b91c1c",
          color: "#fff", padding: "10px 18px", borderRadius: 10, fontSize: 13, fontWeight: 500,
          animation: "toastIn .25s ease", boxShadow: "0 8px 32px rgba(0,0,0,.4)" }}>
          {toast.msg}
        </div>
      )}

      <header style={{ borderBottom: "1px solid #1e293b", padding: "0 28px", display: "flex",
        alignItems: "center", justifyContent: "space-between", height: 58, flexShrink: 0,
        background: "rgba(11,15,25,.95)", backdropFilter: "blur(12px)", position: "sticky", top: 0, zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: "linear-gradient(135deg,#0ea5e9,#6366f1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <Icon d={ICONS.video} size={16} stroke="#fff" />
          </div>
          <span style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 17 }}>MeetHub</span>
          <span style={{ fontSize: 11, color: THEME.textHint, marginLeft: 2 }}>· Jitsi</span>
        </div>
        {activeCall && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.25)", borderRadius: 8, padding: "5px 12px", fontSize: 12, color: "#fca5a5" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "#ef4444" }} className="pulse" />
            Live · {activeCall.title}
            <button onClick={endCall} style={{ color: "#fca5a5", marginLeft: 4, display: "flex" }}>
              <Icon d={ICONS.x} size={13} />
            </button>
          </div>
        )}
      </header>

      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        <nav style={{ width: 56, flexShrink: 0, borderRight: `1px solid ${THEME.borderCard}`, display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 16, gap: 4, background: THEME.bgSurface }}>
          {[
            { id: "quick",     icon: ICONS.video,    label: "Quick Join" },
            { id: "recurring", icon: ICONS.repeat,   label: "Recurring" },
            { id: "schedule",  icon: ICONS.calendar, label: "Schedule" },
            { id: "saved",     icon: ICONS.bookmark, label: "Saved Rooms" },
            ...(activeCall ? [{ id: "call", icon: ICONS.link, label: "Active Call" }] : []),
          ].map(({ id, icon, label }) => (
            <button key={id} onClick={() => setTab(id)} title={label} className="tab-btn"
              style={{ width: 40, height: 40, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", background: tab === id ? THEME.tabActive : "transparent", color: tab === id ? THEME.tabActiveText : THEME.textHint }}>
              <Icon d={icon} size={18} />
              {id === "call" && <span style={{ position: "absolute", top: 5, right: 5, width: 7, height: 7, borderRadius: "50%", background: "#ef4444" }} className="pulse" />}
            </button>
          ))}
        </nav>

        <main style={{ flex: 1, overflowY: "auto", padding: "28px 32px", maxWidth: 800 }}>
          {tab === "quick"     && <QuickJoin     onJoin={joinMeeting} onSave={saveRoom} onCopy={copyLink} joining={joining} />}
          {tab === "recurring" && <RecurringTab  recurring={recurring} onAdd={addRecurring} onDelete={deleteRecurring} onJoin={joinMeeting} onCopy={copyLink} onShare={shareRecurring} showToast={showToast} />}
          {tab === "schedule"  && <ScheduleTab   upcoming={upcoming} past={past} onAdd={addMeeting} onDelete={deleteMeeting} onJoin={joinMeeting} onCopy={copyLink} downloadIcs={downloadIcs} googleCalUrl={googleCalUrl} outlookCalUrl={outlookCalUrl} />}
          {tab === "saved"     && <SavedTab      rooms={savedRooms} onJoin={joinMeeting} onDelete={deleteRoom} onCopy={copyLink} />}
          {tab === "call" && activeCall && <CallTab call={activeCall} onEnd={endCall} iframeRef={iframeRef} />}
        </main>
      </div>
    </div>
  );
}

// ─── Quick Join ───────────────────────────────────────────────────────────────
function QuickJoin({ onJoin, onSave, onCopy, joining }) {
  const [room, setRoom]   = useState(randomRoom());
  const [name, setName]   = useState("");
  const [label, setLabel] = useState("");
  return (
    <div className="fade-up">
      <SectionHeader title="Quick Join" sub="Start or join a meeting in seconds" />
      <div style={card}>
        <Label>Room name</Label>
        <div style={{ display: "flex", gap: 8, marginBottom: 20 }}>
          <input value={room} onChange={e => setRoom(e.target.value.replace(/\s+/g, "-").toLowerCase())} style={{ ...input, flex: 1 }} placeholder="your-meeting-room" />
          <button onClick={() => setRoom(randomRoom())} style={ghostBtn}>Random</button>
        </div>
        <Label>Display name (optional)</Label>
        <input value={name} onChange={e => setName(e.target.value)} style={{ ...input, marginBottom: 24 }} placeholder="Your name" />
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <button onClick={() => onJoin(room, name || room, name)} disabled={joining}
            style={{ ...primaryBtn, opacity: joining ? .6 : 1 }} className="action-btn">
            <Icon d={ICONS.video} size={16} stroke="#fff" />
            {joining ? "Joining…" : name ? `Join as ${name}` : "Join Meeting"}
          </button>
          <button onClick={() => onCopy(room)} style={ghostBtn} className="action-btn">
            <Icon d={ICONS.copy} size={15} /> Copy Invite Link
          </button>
        </div>
      </div>
      <div style={card}>
        <Label>Save this room for later</Label>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={label} onChange={e => setLabel(e.target.value)} style={{ ...input, flex: 1 }} placeholder='Label e.g. "Team standup"' />
          <button onClick={() => { onSave(room, label || room); setLabel(""); }}
            style={{ ...primaryBtn, background: THEME.borderCard, color: "#94a3b8" }} className="action-btn">
            <Icon d={ICONS.bookmark} size={15} /> Save
          </button>
        </div>
        <p style={{ fontSize: 11, color: THEME.textHint, marginTop: 10 }}>🔗 {window.location.origin}/join/{room}</p>
      </div>
    </div>
  );
}

// ─── Recurring Tab ────────────────────────────────────────────────────────────
function RecurringTab({ recurring, onAdd, onDelete, onJoin, onCopy, onShare, showToast }) {
  const FREQS = ["daily", "weekly", "biweekly", "monthly", "custom"];
  const blank = { title: "", room: randomRoom(), freq: "weekly", notes: "", password: "" };
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = () => {
    if (!form.title.trim()) { showToast("Please add a name", "error"); return; }
    onAdd({ id: Date.now(), ...form, room: form.room.trim().replace(/\s+/g, "-").toLowerCase() || randomRoom(), created: new Date().toISOString() });
    setForm(blank);
    setShowForm(false);
  };

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <SectionHeader title="Recurring Meetings" sub="Permanent rooms for people you meet regularly" noMargin />
        <button onClick={() => setShowForm(v => !v)} style={primaryBtn} className="action-btn">
          <Icon d={ICONS.plus} size={15} stroke="#fff" /> New
        </button>
      </div>

      {showForm && (
        <div style={{ ...card, border: "1px solid #38bdf8", marginBottom: 20 }}>
          <Label>Name / Title *</Label>
          <input value={form.title} onChange={f("title")} style={{ ...input, marginBottom: 16 }} placeholder='e.g. "Ana", "Team Sync", "1:1 with João"' />
          <Label>Room name</Label>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input value={form.room} onChange={f("room")} style={{ ...input, flex: 1 }} />
            <button onClick={() => setForm(p => ({ ...p, room: randomRoom() }))} style={ghostBtn}>Random</button>
          </div>
          <Label>Frequency</Label>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: 16 }}>
            {FREQS.map(fq => (
              <button key={fq} onClick={() => setForm(p => ({ ...p, freq: fq }))}
                className={`freq-pill${form.freq === fq ? " active" : ""}`}>
                {FREQ_LABELS[fq]}
              </button>
            ))}
          </div>
          <Label>Notes (optional)</Label>
          <textarea value={form.notes} onChange={f("notes")} style={{ ...input, height: 60, resize: "none", marginBottom: 16 }} placeholder="Agenda, context…" />
          <Label>Password (optional)</Label>
          <div style={{ position: "relative", marginBottom: 0 }}>
            <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: THEME.textHint, pointerEvents: "none" }}>
              <Icon d={ICONS.lock} size={14} />
            </span>
            <input value={form.password} onChange={f("password")} style={{ ...input, paddingLeft: 34 }} placeholder="Leave blank for no password" />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={submit} style={primaryBtn} className="action-btn">Create Meeting</button>
            <button onClick={() => { setShowForm(false); setForm(blank); }} style={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}

      {recurring.length === 0
        ? <EmptyState icon={ICONS.repeat} text="No recurring meetings yet. Create one for anyone you meet regularly." />
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {recurring.map((r, i) => (
              <div key={r.id} className="card rec-card" style={{ background: THEME.bgCard, border: "1px solid #1e293b", borderRadius: 13, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 44, height: 44, borderRadius: "50%", flexShrink: 0, background: avatarColor(i), display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 15, color: "#fff" }}>
                  {initials(r.title)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 3, flexWrap: "wrap" }}>
                    <p style={{ fontWeight: 600, fontSize: 15 }}>{r.title}</p>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 20, background: FREQ_COLORS[r.freq] || FREQ_COLORS.custom, border: `1px solid ${FREQ_BORDERS[r.freq] || FREQ_BORDERS.custom}`, color: FREQ_TEXT[r.freq] || FREQ_TEXT.custom }}>
                      {FREQ_LABELS[r.freq] || r.freq}
                    </span>
                    {r.password && <span style={{ fontSize: 10, color: THEME.textMuted, display: "flex", alignItems: "center", gap: 3 }}><Icon d={ICONS.lock} size={11} stroke={THEME.textMuted} /> password</span>}
                  </div>
                  <p style={{ fontSize: 11, color: THEME.textHint }}>8x8.vc/{JAAS_APP_ID}/{r.room}</p>
                  {r.notes && <p style={{ fontSize: 11, color: THEME.textMuted, marginTop: 2, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.notes}</p>}
                </div>
                <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                  <button onClick={() => onCopy(r.room, r.password)} style={icoBtn} title="Copy invite link"><Icon d={ICONS.copy} size={14} /></button>
                  <button onClick={() => onShare(r.room, r.title, r.password)} style={{ ...icoBtn, color: "#38bdf8", borderColor: "rgba(56,189,248,.25)", background: "rgba(56,189,248,.08)" }} title="Share">
                    <Icon d={ICONS.share} size={14} />
                  </button>
                  <button onClick={() => onJoin(r.room, r.title)} style={{ ...icoBtn, color: "#38bdf8" }} title="Join now"><Icon d={ICONS.arrow} size={14} /></button>
                  <button onClick={() => onDelete(r.id)} style={{ ...icoBtn, color: "#ef4444" }} title="Delete"><Icon d={ICONS.trash} size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )
      }
    </div>
  );
}

// ─── Schedule Tab ─────────────────────────────────────────────────────────────
function CalendarMenu({ m, downloadIcs, googleCalUrl, outlookCalUrl }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <button onClick={() => setOpen(v => !v)} style={{ ...icoBtn, color: "#a78bfa", borderColor: "rgba(167,139,250,.25)", background: "rgba(167,139,250,.08)" }} title="Add to Calendar">
        <Icon d={ICONS.calendar} size={14} />
      </button>
      {open && (
        <div style={{ position: "absolute", right: 0, top: 36, zIndex: 200, background: THEME.borderCard, border: "1px solid #334155", borderRadius: 10, padding: "6px", minWidth: 220, boxShadow: "0 8px 32px rgba(0,0,0,.5)" }}>
          <p style={{ fontSize: 10, fontWeight: 600, color: THEME.textHint, textTransform: "uppercase", letterSpacing: ".07em", padding: "4px 10px 8px" }}>Add to calendar</p>
          <a href={googleCalUrl(m)} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className="cal-opt"
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 7, color: THEME.textMain, textDecoration: "none", fontSize: 13 }}>
            <span style={{ fontSize: 15 }}>🗓️</span> Google Calendar
          </a>
          <a href={outlookCalUrl(m)} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className="cal-opt"
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 7, color: THEME.textMain, textDecoration: "none", fontSize: 13 }}>
            <span style={{ fontSize: 15 }}>📅</span> Outlook / Microsoft 365
          </a>
          <button onClick={() => { downloadIcs(m); setOpen(false); }} className="cal-opt"
            style={{ display: "flex", alignItems: "center", gap: 9, padding: "8px 10px", borderRadius: 7, color: THEME.textMain, fontSize: 13, width: "100%", background: "transparent" }}>
            <span style={{ fontSize: 15 }}>📥</span> Apple / Proton / Other (.ics)
          </button>
        </div>
      )}
    </div>
  );
}

function ScheduleTab({ upcoming, past, onAdd, onDelete, onJoin, onCopy, downloadIcs, googleCalUrl, outlookCalUrl }) {
  const blank = { title: "", room: randomRoom(), time: "", notes: "", password: "" };
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(blank);
  const f = k => e => setForm(p => ({ ...p, [k]: e.target.value }));

  const submit = () => {
    if (!form.title || !form.time) return;
    onAdd({ id: Date.now(), ...form, room: form.room.trim().replace(/\s+/g, "-").toLowerCase() });
    setForm(blank);
    setShowForm(false);
  };

  return (
    <div className="fade-up">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <SectionHeader title="Meetings" sub="Schedule one-off calls" noMargin />
        <button onClick={() => setShowForm(v => !v)} style={primaryBtn} className="action-btn">
          <Icon d={ICONS.plus} size={15} stroke="#fff" /> New Meeting
        </button>
      </div>

      {showForm && (
        <div style={{ ...card, border: "1px solid #38bdf8", marginBottom: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 16 }}>
            <div><Label>Title *</Label><input value={form.title} onChange={f("title")} style={input} placeholder="Weekly standup" /></div>
            <div><Label>Date & time *</Label><input type="datetime-local" value={form.time} onChange={f("time")} style={input} /></div>
          </div>
          <Label>Room name</Label>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <input value={form.room} onChange={f("room")} style={{ ...input, flex: 1 }} />
            <button onClick={() => setForm(p => ({ ...p, room: randomRoom() }))} style={ghostBtn}>Random</button>
          </div>
          <Label>Notes (optional)</Label>
          <textarea value={form.notes} onChange={f("notes")} style={{ ...input, height: 70, resize: "none", marginBottom: 16 }} placeholder="Agenda, links…" />
          <Label>Password (optional)</Label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)", color: THEME.textHint, pointerEvents: "none" }}>
              <Icon d={ICONS.lock} size={14} />
            </span>
            <input value={form.password} onChange={f("password")} style={{ ...input, paddingLeft: 34 }} placeholder="Leave blank for no password" />
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <button onClick={submit} style={primaryBtn} className="action-btn">Schedule Meeting</button>
            <button onClick={() => { setShowForm(false); setForm(blank); }} style={ghostBtn}>Cancel</button>
          </div>
        </div>
      )}

      {upcoming.length > 0 && <>
        <p style={sectionLabel}>Upcoming</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
          {upcoming.map(m => (
            <div key={m.id} style={{ background: THEME.bgCard, border: "1px solid #1e293b", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }} className="card">
              <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, background: "rgba(56,189,248,.1)", border: "1px solid rgba(56,189,248,.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#38bdf8" }}>
                <Icon d={ICONS.clock} size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 2 }}>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{m.title}</p>
                  {m.password && <span style={{ fontSize: 10, color: THEME.textMuted, display: "flex", alignItems: "center", gap: 3 }}><Icon d={ICONS.lock} size={11} stroke={THEME.textMuted} /> password</span>}
                </div>
                <p style={{ fontSize: 12, color: THEME.textMuted }}>{fmt(m.time)}<span style={{ color: "#0ea5e9", marginLeft: 8 }}>{timeUntil(m.time)}</span></p>
                {m.notes && <p style={{ fontSize: 11, color: THEME.textHint, marginTop: 3, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.notes}</p>}
              </div>
              <div style={{ display: "flex", gap: 6, flexShrink: 0, alignItems: "center" }}>
                <button onClick={() => onCopy(m.room, m.password)} style={icoBtn} title="Copy invite link"><Icon d={ICONS.copy} size={14} /></button>
                <CalendarMenu m={m} downloadIcs={downloadIcs} googleCalUrl={googleCalUrl} outlookCalUrl={outlookCalUrl} />
                <button onClick={() => onJoin(m.room, m.title)} style={{ ...icoBtn, color: "#38bdf8" }} title="Join"><Icon d={ICONS.arrow} size={14} /></button>
                <button onClick={() => onDelete(m.id)} style={{ ...icoBtn, color: "#ef4444" }} title="Delete"><Icon d={ICONS.trash} size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </>}

      {past.length > 0 && <>
        <p style={sectionLabel}>Past</p>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {past.map(m => (
            <div key={m.id} style={{ background: THEME.bgCard, border: "1px solid #12161f", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14, opacity: .65 }} className="card">
              <div style={{ width: 42, height: 42, borderRadius: 10, flexShrink: 0, background: "rgba(71,85,105,.15)", border: "1px solid #1e293b", display: "flex", alignItems: "center", justifyContent: "center", color: THEME.textHint }}>
                <Icon d={ICONS.clock} size={18} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontWeight: 600, fontSize: 14 }}>{m.title}</p>
                <p style={{ fontSize: 12, color: THEME.textMuted }}>{fmt(m.time)}</p>
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={() => onJoin(m.room, m.title)} style={{ ...icoBtn, color: "#38bdf8" }} title="Join again"><Icon d={ICONS.arrow} size={14} /></button>
                <button onClick={() => onDelete(m.id)} style={{ ...icoBtn, color: "#ef4444" }} title="Delete"><Icon d={ICONS.trash} size={14} /></button>
              </div>
            </div>
          ))}
        </div>
      </>}

      {upcoming.length === 0 && past.length === 0 && <EmptyState icon={ICONS.calendar} text="No meetings yet. Schedule your first one!" />}
    </div>
  );
}

// ─── Saved Tab ────────────────────────────────────────────────────────────────
function SavedTab({ rooms, onJoin, onDelete, onCopy }) {
  return (
    <div className="fade-up">
      <SectionHeader title="Saved Rooms" sub="Your favourite and recurring meeting rooms" />
      {rooms.length === 0
        ? <EmptyState icon={ICONS.bookmark} text="No saved rooms yet. Save a room from Quick Join." />
        : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {rooms.map(r => (
              <div key={r.id} style={{ background: THEME.bgCard, border: "1px solid #1e293b", borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 14 }} className="card">
                <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: "rgba(99,102,241,.1)", border: "1px solid rgba(99,102,241,.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#818cf8" }}>
                  <Icon d={ICONS.bookmark} size={17} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{r.label}</p>
                  <p style={{ fontSize: 11, color: THEME.textHint, marginTop: 1 }}>8x8.vc/{JAAS_APP_ID}/{r.room}</p>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  <button onClick={() => onCopy(r.room)} style={icoBtn} title="Copy invite link"><Icon d={ICONS.copy} size={14} /></button>
                  <button onClick={() => onJoin(r.room, r.label)} style={{ ...icoBtn, color: "#38bdf8" }} title="Join"><Icon d={ICONS.arrow} size={14} /></button>
                  <button onClick={() => onDelete(r.id)} style={{ ...icoBtn, color: "#ef4444" }} title="Remove"><Icon d={ICONS.trash} size={14} /></button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

// ─── Call Tab ─────────────────────────────────────────────────────────────────
function CallTab({ call, onEnd, iframeRef }) {
  const url = `${meetUrl(call.room)}#jwt=${call.token}`;
  return (
    <div className="fade-up" style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 110px)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div>
          <h2 style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 20 }}>{call.title}</h2>
          <a href={meetUrl(call.room)} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: "#38bdf8", textDecoration: "none" }}>{meetUrl(call.room)} ↗</a>
        </div>
        <button onClick={onEnd} style={{ background: "rgba(239,68,68,.12)", border: "1px solid rgba(239,68,68,.25)", color: "#fca5a5", borderRadius: 8, padding: "7px 16px", fontSize: 13, fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }} className="action-btn">
          <Icon d={ICONS.x} size={14} stroke="#fca5a5" /> End Call
        </button>
      </div>
      <div style={{ flex: 1, borderRadius: 16, overflow: "hidden", border: "1px solid #1e293b" }}>
        <iframe ref={iframeRef} src={url} allow="camera; microphone; fullscreen; display-capture; autoplay" style={{ width: "100%", height: "100%", border: "none" }} title={call.title} />
      </div>
    </div>
  );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function SectionHeader({ title, sub, noMargin }) {
  return (
    <div style={{ marginBottom: noMargin ? 0 : 24 }}>
      <h1 style={{ fontFamily: "Syne", fontWeight: 700, fontSize: 22, marginBottom: 4 }}>{title}</h1>
      {sub && <p style={{ color: THEME.textMuted, fontSize: 13 }}>{sub}</p>}
    </div>
  );
}
function Label({ children }) {
  return <label style={{ fontSize: 11, fontWeight: 600, color: THEME.textMuted, textTransform: "uppercase", letterSpacing: ".07em", display: "block", marginBottom: 7 }}>{children}</label>;
}
function EmptyState({ icon, text }) {
  return (
    <div style={{ textAlign: "center", padding: "60px 0" }}>
      <div style={{ marginBottom: 14, opacity: .4 }}><Icon d={icon} size={40} stroke={THEME.textMuted} /></div>
      <p style={{ fontSize: 13, color: THEME.textHint }}>{text}</p>
    </div>
  );
}

// ─── Style tokens ─────────────────────────────────────────────────────────────
const input      = { width: "100%", background: THEME.bgInput, border: "1px solid #1e293b", borderRadius: 9, padding: "9px 13px", color: THEME.textMain, fontSize: 13, display: "block" };
const card       = { background: THEME.bgCard, border: "1px solid #1e293b", borderRadius: 16, padding: "24px 24px 20px", marginBottom: 16 };
const primaryBtn = { background: THEME.primary, color: "#fff", borderRadius: 9, padding: "9px 18px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 7, cursor: "pointer", border: "none" };
const ghostBtn   = { background: THEME.ghostBg, border: "1px solid #1e293b", color: "#94a3b8", borderRadius: 9, padding: "9px 14px", fontSize: 13, fontWeight: 500, display: "flex", alignItems: "center", gap: 7, cursor: "pointer" };
const icoBtn     = { width: 32, height: 32, borderRadius: 8, background: THEME.ghostBg, border: "1px solid #1e293b", color: THEME.textMuted, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", transition: "all .15s" };
const sectionLabel = { fontSize: 11, fontWeight: 600, color: THEME.textHint, textTransform: "uppercase", letterSpacing: ".08em", marginBottom: 12, display: "block" };

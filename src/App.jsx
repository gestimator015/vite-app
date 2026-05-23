import { useState, useEffect, useCallback, useRef } from "react";

// ─── Server Config ───────────────────────────────────────────────────────────
// 🔧 TO SWITCH SERVERS: change this one line only.
// Examples:
//   "meet.jit.si"          → Jitsi's free public servers (current)
//   "meet.yourcompany.com" → Your own self-hosted Jitsi (AWS, DigitalOcean, etc.)
const JITSI_SERVER = import.meta.env.VITE_JITSI_SERVER || "meet.jit.si";

const meetUrl = (room) => `https://${JITSI_SERVER}/${room}`;

// ─── Helpers ────────────────────────────────────────────────────────────────
const adjectives = ["swift","amber","crystal","lunar","nova","solar","cosmic","echo","delta","zenith","prism","atlas"];
const nouns = ["summit","orbit","bridge","nexus","pulse","wave","forge","spark","vault","haven","peak","link"];
const randomRoom = () =>
  `${adjectives[Math.floor(Math.random()*adjectives.length)]}-${nouns[Math.floor(Math.random()*nouns.length)]}-${Math.floor(Math.random()*900+100)}`;

const fmt = (iso) => {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US",{month:"short",day:"numeric"}) + " · " +
    d.toLocaleTimeString("en-US",{hour:"2-digit",minute:"2-digit"});
};

const timeUntil = (iso) => {
  const diff = new Date(iso) - Date.now();
  if (diff < 0) return "now";
  const m = Math.floor(diff/60000);
  if (m < 60) return `in ${m}m`;
  const h = Math.floor(m/60);
  if (h < 24) return `in ${h}h`;
  return `in ${Math.floor(h/24)}d`;
};

// ─── Calendar Helpers ────────────────────────────────────────────────────────
const toCalDate = (iso) => new Date(iso).toISOString().replace(/[-:]/g,"").split(".")[0]+"Z";

const googleCalUrl = (m) => {
  const start = toCalDate(m.time);
  const end   = toCalDate(new Date(new Date(m.time).getTime() + 60*60*1000).toISOString());
  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(m.title)}&dates=${start}/${end}&details=${encodeURIComponent(`Join at ${meetUrl(m.room)}\n\n${m.notes||""}`)}&location=${encodeURIComponent(meetUrl(m.room))}`;
};

const outlookCalUrl = (m) => {
  const start = new Date(m.time).toISOString();
  const end   = new Date(new Date(m.time).getTime() + 60*60*1000).toISOString();
  return `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(m.title)}&startdt=${start}&enddt=${end}&body=${encodeURIComponent(`Join at ${meetUrl(m.room)}\n\n${m.notes||""}`)}&location=${encodeURIComponent(meetUrl(m.room))}`;
};

// ─── Storage helpers (localStorage with optional window.storage override) ────
async function load(key) {
  try {
    if (window.storage) {
      const r = await window.storage.get(key);
      return r ? JSON.parse(r.value) : null;
    }
    const r = localStorage.getItem(key);
    return r ? JSON.parse(r) : null;
  } catch { return null; }
}

async function save(key, val) {
  try {
    if (window.storage) {
      await window.storage.set(key, JSON.stringify(val));
    } else {
      localStorage.setItem(key, JSON.stringify(val));
    }
  } catch {}
}

// ─── Icons ───────────────────────────────────────────────────────────────────
const Icon = ({ d, size=18, stroke="currentColor", fill="none" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d={d}/>
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
  expand:   "M15 3h6m0 0v6m0-6L14 10M9 21H3m0 0v-6m0 6l7-7",
};

// ─── App ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("quick");
  const [activeCall, setActiveCall] = useState(null); // { room, title }
  const [savedRooms, setSavedRooms] = useState([]);
  const [meetings, setMeetings] = useState([]);
  const [toast, setToast] = useState(null);
  const iframeRef = useRef(null);

  // Load persisted data
  useEffect(() => {
    (async () => {
      const rooms = await load("jitsi:saved");
      const sched = await load("jitsi:meetings");
      if (rooms) setSavedRooms(rooms);
      if (sched) setMeetings(sched);
    })();
  }, []);

  const showToast = (msg, type="success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 2500);
  };

  const joinMeeting = (room, title) => {
    setActiveCall({ room: room.trim().replace(/\s+/g,"-").toLowerCase(), title: title || room });
    setTab("call");
  };

  const endCall = () => { setActiveCall(null); setTab("quick"); };

  const saveRoom = useCallback(async (room, label) => {
    const entry = { id: Date.now(), room, label: label || room };
    const next = [entry, ...savedRooms].slice(0, 20);
    setSavedRooms(next);
    await save("jitsi:saved", next);
    showToast("Room saved!");
  }, [savedRooms]);

  const deleteRoom = useCallback(async (id) => {
    const next = savedRooms.filter(r => r.id !== id);
    setSavedRooms(next);
    await save("jitsi:saved", next);
  }, [savedRooms]);

  const addMeeting = useCallback(async (m) => {
    const next = [m, ...meetings].sort((a,b) => new Date(a.time)-new Date(b.time)).slice(0,50);
    setMeetings(next);
    await save("jitsi:meetings", next);
    showToast("Meeting scheduled!");
  }, [meetings]);

  const deleteMeeting = useCallback(async (id) => {
    const next = meetings.filter(m => m.id !== id);
    setMeetings(next);
    await save("jitsi:meetings", next);
  }, [meetings]);

  const copyLink = (room) => {
    navigator.clipboard.writeText(meetUrl(room)).then(() => showToast("Link copied!"));
  };

  const upcoming = meetings.filter(m => new Date(m.time) > Date.now() - 60000*5)
                           .sort((a,b) => new Date(a.time)-new Date(b.time));
  const past     = meetings.filter(m => new Date(m.time) <= Date.now() - 60000*5);

  return (
    <div style={{
      minHeight:"100vh", background:"#0b0f19",
      fontFamily:"'DM Sans', 'Segoe UI', sans-serif", color:"#e2e8f0",
      display:"flex", flexDirection:"column",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@600;700;800&display=swap');
        * { box-sizing: border-box; margin:0; padding:0; }
        ::-webkit-scrollbar { width:4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #334155; border-radius:4px; }
        input, textarea, select { outline:none; }
        button { cursor:pointer; border:none; background:none; }
        .tab-btn { transition: all .2s; }
        .tab-btn:hover { background: rgba(56,189,248,.08) !important; }
        .action-btn { transition: all .18s; }
        .action-btn:hover { transform: translateY(-1px); filter: brightness(1.12); }
        .card { transition: box-shadow .2s; }
        .card:hover { box-shadow: 0 4px 32px rgba(56,189,248,.07) !important; }
        .ghost-btn:hover { background: rgba(255,255,255,.07) !important; }
        @keyframes fadeUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes toastIn { from { opacity:0; transform:translateX(24px); } to { opacity:1; transform:translateX(0); } }
        .fade-up { animation: fadeUp .32s ease forwards; }
        .pulse { animation: pulse 2s infinite; }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:.5; } }
      `}</style>

      {/* Toast */}
      {toast && (
        <div style={{
          position:"fixed", top:20, right:20, zIndex:9999,
          background: toast.type==="success" ? "#0f766e" : "#b91c1c",
          color:"#fff", padding:"10px 18px", borderRadius:10,
          fontSize:13, fontWeight:500, animation:"toastIn .25s ease",
          boxShadow:"0 8px 32px rgba(0,0,0,.4)"
        }}>{toast.msg}</div>
      )}

      {/* Header */}
      <header style={{
        borderBottom:"1px solid #1e293b",
        padding:"0 28px",
        display:"flex", alignItems:"center", justifyContent:"space-between",
        height:58, flexShrink:0,
        background:"rgba(11,15,25,.95)", backdropFilter:"blur(12px)",
        position:"sticky", top:0, zIndex:100,
      }}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{
            width:32,height:32,borderRadius:9,
            background:"linear-gradient(135deg,#0ea5e9,#6366f1)",
            display:"flex",alignItems:"center",justifyContent:"center",
          }}>
            <Icon d={ICONS.video} size={16} stroke="#fff"/>
          </div>
          <span style={{fontFamily:"Syne",fontWeight:700,fontSize:17,letterSpacing:".5px"}}>MeetHub</span>
          <span style={{fontSize:11,color:"#475569",marginLeft:2}}>· Jitsi</span>
        </div>
        {activeCall && (
          <div style={{
            display:"flex",alignItems:"center",gap:8,
            background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.25)",
            borderRadius:8,padding:"5px 12px",fontSize:12,color:"#fca5a5",
          }}>
            <span style={{width:7,height:7,borderRadius:"50%",background:"#ef4444"}} className="pulse"/>
            Live · {activeCall.title}
            <button onClick={endCall} style={{color:"#fca5a5",marginLeft:4}} className="ghost-btn">
              <Icon d={ICONS.x} size={13}/>
            </button>
          </div>
        )}
      </header>

      {/* Layout */}
      <div style={{display:"flex",flex:1,overflow:"hidden"}}>

        {/* Sidebar */}
        <nav style={{
          width:56, flexShrink:0, borderRight:"1px solid #1e293b",
          display:"flex",flexDirection:"column",alignItems:"center",
          paddingTop:16,gap:4,
          background:"#090d16",
        }}>
          {[
            {id:"quick",  icon:ICONS.video,    label:"Quick Join"},
            {id:"schedule",icon:ICONS.calendar, label:"Schedule"},
            {id:"saved",  icon:ICONS.bookmark,  label:"Saved Rooms"},
            ...(activeCall ? [{id:"call",icon:ICONS.link,label:"Active Call"}] : []),
          ].map(({id,icon,label}) => (
            <button key={id} onClick={()=>setTab(id)}
              title={label}
              className="tab-btn"
              style={{
                width:40,height:40,borderRadius:10,
                display:"flex",alignItems:"center",justifyContent:"center",
                background: tab===id ? "rgba(56,189,248,.15)" : "transparent",
                color: tab===id ? "#38bdf8" : "#475569",
                position:"relative",
              }}>
              <Icon d={icon} size={18}/>
              {id==="call" && (
                <span style={{
                  position:"absolute",top:5,right:5,width:7,height:7,
                  borderRadius:"50%",background:"#ef4444"
                }} className="pulse"/>
              )}
            </button>
          ))}
        </nav>

        {/* Main */}
        <main style={{flex:1,overflowY:"auto",padding:"28px 32px",maxWidth:780}}>

          {/* ── QUICK JOIN ── */}
          {tab==="quick" && <QuickJoin onJoin={joinMeeting} onSave={saveRoom} onCopy={copyLink} showToast={showToast}/>}

          {/* ── SCHEDULE ── */}
          {tab==="schedule" && (
            <ScheduleTab
              upcoming={upcoming} past={past}
              onAdd={addMeeting} onDelete={deleteMeeting}
              onJoin={joinMeeting} onCopy={copyLink}
            />
          )}

          {/* ── SAVED ROOMS ── */}
          {tab==="saved" && (
            <SavedTab rooms={savedRooms} onJoin={joinMeeting} onDelete={deleteRoom} onCopy={copyLink}/>
          )}

          {/* ── ACTIVE CALL ── */}
          {tab==="call" && activeCall && (
            <CallTab call={activeCall} onEnd={endCall} iframeRef={iframeRef}/>
          )}
        </main>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function QuickJoin({ onJoin, onSave, onCopy, showToast }) {
  const [room, setRoom] = useState(randomRoom());
  const [name, setName] = useState("");
  const [saveLabel, setSaveLabel] = useState("");
  const url = meetUrl(room);

  return (
    <div className="fade-up">
      <SectionHeader title="Quick Join" sub="Start or join a meeting in seconds"/>
      <div style={{
        background:"#111827",border:"1px solid #1e293b",
        borderRadius:16,padding:"28px 28px 24px",marginBottom:20,
      }} className="card">
        <label style={labelStyle}>Room name</label>
        <div style={{display:"flex",gap:8,marginBottom:20}}>
          <input
            value={room} onChange={e=>setRoom(e.target.value.replace(/\s+/g,"-").toLowerCase())}
            style={{...inputStyle,flex:1}}
            placeholder="your-meeting-room"
          />
          <button onClick={()=>setRoom(randomRoom())}
            style={{...ghostBtn,padding:"0 14px",fontSize:12,color:"#64748b"}}>
            Random
          </button>
        </div>

        <label style={labelStyle}>Your display name (optional)</label>
        <input value={name} onChange={e=>setName(e.target.value)}
          style={{...inputStyle,marginBottom:24}} placeholder="Jane Smith"/>

        <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
          <button onClick={()=>onJoin(room, name||room)}
            style={{...primaryBtn}} className="action-btn">
            <Icon d={ICONS.video} size={16} stroke="#fff"/>
            {name ? `Join as ${name}` : "Join Meeting"}
          </button>
          <button onClick={()=>onCopy(room)} style={{...ghostBtn}} className="action-btn">
            <Icon d={ICONS.copy} size={15}/>
            Copy Link
          </button>
        </div>
      </div>

      {/* Quick Save */}
      <div style={{
        background:"#111827",border:"1px solid #1e293b",
        borderRadius:16,padding:"20px 24px",
      }} className="card">
        <label style={labelStyle}>Save this room for later</label>
        <div style={{display:"flex",gap:8}}>
          <input value={saveLabel} onChange={e=>setSaveLabel(e.target.value)}
            style={{...inputStyle,flex:1}} placeholder={`Label (e.g. "Team standup")`}/>
          <button onClick={()=>{ onSave(room,saveLabel||room); setSaveLabel(""); }}
            style={{...primaryBtn,background:"#1e293b",color:"#94a3b8"}} className="action-btn">
            <Icon d={ICONS.bookmark} size={15}/>
            Save
          </button>
        </div>
        <p style={{fontSize:11,color:"#475569",marginTop:10}}>
          🔗 {url}
        </p>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function ScheduleTab({ upcoming, past, onAdd, onDelete, onJoin, onCopy }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ title:"", room:randomRoom(), time:"", notes:"" });
  const f = (k) => e => setForm(p=>({...p,[k]:e.target.value}));

  const submit = () => {
    if (!form.title || !form.time) return;
    onAdd({ id:Date.now(), ...form, room: form.room.trim().replace(/\s+/g,"-").toLowerCase() });
    setForm({ title:"", room:randomRoom(), time:"", notes:"" });
    setShowForm(false);
  };

  return (
    <div className="fade-up">
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:24}}>
        <SectionHeader title="Meetings" sub="Schedule and manage your calls" noMargin/>
        <button onClick={()=>setShowForm(v=>!v)} style={{...primaryBtn,fontSize:13}} className="action-btn">
          <Icon d={ICONS.plus} size={15} stroke="#fff"/>
          New Meeting
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div style={{
          background:"#111827",border:"1px solid #38bdf8",borderRadius:16,
          padding:"24px",marginBottom:20,animation:"fadeUp .2s ease",
        }}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16,marginBottom:16}}>
            <div>
              <label style={labelStyle}>Meeting title *</label>
              <input value={form.title} onChange={f("title")} style={inputStyle} placeholder="Weekly standup"/>
            </div>
            <div>
              <label style={labelStyle}>Date & time *</label>
              <input type="datetime-local" value={form.time} onChange={f("time")} style={inputStyle}/>
            </div>
          </div>
          <label style={labelStyle}>Room name</label>
          <div style={{display:"flex",gap:8,marginBottom:16}}>
            <input value={form.room} onChange={f("room")} style={{...inputStyle,flex:1}}/>
            <button onClick={()=>setForm(p=>({...p,room:randomRoom()}))} style={{...ghostBtn,fontSize:12,padding:"0 12px",color:"#64748b"}}>Random</button>
          </div>
          <label style={labelStyle}>Notes (optional)</label>
          <textarea value={form.notes} onChange={f("notes")} style={{...inputStyle,height:70,resize:"none"}} placeholder="Agenda, links…"/>
          <div style={{display:"flex",gap:10,marginTop:16}}>
            <button onClick={submit} style={primaryBtn} className="action-btn">Schedule Meeting</button>
            <button onClick={()=>setShowForm(false)} style={{...ghostBtn}} className="action-btn">Cancel</button>
          </div>
        </div>
      )}

      {/* Upcoming */}
      {upcoming.length > 0 && (
        <>
          <p style={{fontSize:11,fontWeight:600,color:"#475569",textTransform:"uppercase",letterSpacing:".08em",marginBottom:12}}>Upcoming</p>
          <div style={{display:"flex",flexDirection:"column",gap:10,marginBottom:24}}>
            {upcoming.map(m=>(
              <MeetingCard key={m.id} m={m} onJoin={onJoin} onDelete={onDelete} onCopy={onCopy} variant="upcoming"/>
            ))}
          </div>
        </>
      )}

      {/* Past */}
      {past.length > 0 && (
        <>
          <p style={{fontSize:11,fontWeight:600,color:"#475569",textTransform:"uppercase",letterSpacing:".08em",marginBottom:12}}>Past</p>
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {past.map(m=>(
              <MeetingCard key={m.id} m={m} onJoin={onJoin} onDelete={onDelete} onCopy={onCopy} variant="past"/>
            ))}
          </div>
        </>
      )}

      {upcoming.length===0 && past.length===0 && (
        <EmptyState icon={ICONS.calendar} text="No meetings yet. Schedule your first one!"/>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function CalendarMenu({ m }) {
  const [open, setOpen] = useState(false);
  const downloadIcs = () => {
    const start = toCalDate(m.time);
    const end   = toCalDate(new Date(new Date(m.time).getTime()+60*60*1000).toISOString());
    const content = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//MeetHub//EN","BEGIN:VEVENT",
      `DTSTART:${start}`,`DTEND:${end}`,`SUMMARY:${m.title}`,
      `DESCRIPTION:Join at ${meetUrl(m.room)}\\n\\n${m.notes||""}`,
      `LOCATION:${meetUrl(m.room)}`,`UID:${m.id}@meethub`,
      "END:VEVENT","END:VCALENDAR"].join("\r\n");
    const blob = new Blob([content],{type:"text/calendar;charset=utf-8"});
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href=url; a.download=`${m.title.replace(/\s+/g,"-")}.ics`; a.click();
    URL.revokeObjectURL(url);
    setOpen(false);
  };
  const options = [
    { label:"Google Calendar", icon:"🗓️", href: googleCalUrl(m) },
    { label:"Outlook",         icon:"📅", href: outlookCalUrl(m) },
    { label:"Apple / Proton / Other (.ics)", icon:"📥", href: null },
  ];
  return (
    <div style={{position:"relative"}}>
      <button onClick={()=>setOpen(v=>!v)}
        style={{...iconBtn, color:"#a78bfa", borderColor:"rgba(167,139,250,.25)", background:"rgba(167,139,250,.08)"}}
        title="Add to Calendar">
        <Icon d={ICONS.calendar} size={14}/>
      </button>
      {open && (
        <div style={{
          position:"absolute",right:0,top:36,zIndex:200,
          background:"#1e293b",border:"1px solid #334155",borderRadius:10,
          padding:"6px",minWidth:210,boxShadow:"0 8px 32px rgba(0,0,0,.5)",
        }}>
          <p style={{fontSize:10,fontWeight:600,color:"#475569",textTransform:"uppercase",
            letterSpacing:".07em",padding:"4px 10px 8px"}}>Add to calendar</p>
          {options.map(o=>(
            o.href
              ? <a key={o.label} href={o.href} target="_blank" rel="noreferrer"
                  onClick={()=>setOpen(false)}
                  style={{display:"flex",alignItems:"center",gap:9,padding:"8px 10px",
                    borderRadius:7,color:"#e2e8f0",textDecoration:"none",fontSize:13,
                    cursor:"pointer",transition:"background .15s"}}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.06)"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <span style={{fontSize:15}}>{o.icon}</span>{o.label}
                </a>
              : <button key={o.label} onClick={downloadIcs}
                  style={{display:"flex",alignItems:"center",gap:9,padding:"8px 10px",
                    borderRadius:7,color:"#e2e8f0",fontSize:13,width:"100%",
                    cursor:"pointer",transition:"background .15s",background:"transparent"}}
                  onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,.06)"}
                  onMouseLeave={e=>e.currentTarget.style.background="transparent"}>
                  <span style={{fontSize:15}}>{o.icon}</span>{o.label}
                </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MeetingCard({ m, onJoin, onDelete, onCopy, variant }) {
  return (
    <div style={{
      background:"#111827",border:`1px solid ${variant==="upcoming"?"#1e293b":"#12161f"}`,
      borderRadius:12,padding:"14px 18px",
      display:"flex",alignItems:"center",gap:14,
      opacity: variant==="past" ? .65 : 1,
    }} className="card">
      <div style={{
        width:42,height:42,borderRadius:10,flexShrink:0,
        background: variant==="upcoming" ? "rgba(56,189,248,.1)" : "rgba(71,85,105,.15)",
        border:`1px solid ${variant==="upcoming"?"rgba(56,189,248,.2)":"#1e293b"}`,
        display:"flex",alignItems:"center",justifyContent:"center",
        color: variant==="upcoming" ? "#38bdf8" : "#475569",
      }}>
        <Icon d={ICONS.clock} size={18}/>
      </div>
      <div style={{flex:1,minWidth:0}}>
        <p style={{fontWeight:600,fontSize:14,marginBottom:2}}>{m.title}</p>
        <p style={{fontSize:12,color:"#64748b"}}>
          {fmt(m.time)}
          {variant==="upcoming" && <span style={{color:"#0ea5e9",marginLeft:8}}>{timeUntil(m.time)}</span>}
        </p>
        {m.notes && <p style={{fontSize:11,color:"#475569",marginTop:3,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{m.notes}</p>}
      </div>
      <div style={{display:"flex",gap:6,flexShrink:0,alignItems:"center"}}>
        <button onClick={()=>onCopy(m.room)} style={{...iconBtn}} title="Copy link"><Icon d={ICONS.copy} size={14}/></button>
        {variant==="upcoming" && <CalendarMenu m={m}/>}
        <button onClick={()=>onJoin(m.room,m.title)} style={{...iconBtn,color:"#38bdf8"}} title="Join"><Icon d={ICONS.arrow} size={14}/></button>
        <button onClick={()=>onDelete(m.id)} style={{...iconBtn,color:"#ef4444"}} title="Delete"><Icon d={ICONS.trash} size={14}/></button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function SavedTab({ rooms, onJoin, onDelete, onCopy }) {
  return (
    <div className="fade-up">
      <SectionHeader title="Saved Rooms" sub="Your favorite and recurring meeting rooms"/>
      {rooms.length === 0
        ? <EmptyState icon={ICONS.bookmark} text="No saved rooms yet. Save a room from Quick Join."/>
        : (
          <div style={{display:"flex",flexDirection:"column",gap:10}}>
            {rooms.map(r=>(
              <div key={r.id} style={{
                background:"#111827",border:"1px solid #1e293b",
                borderRadius:12,padding:"14px 18px",
                display:"flex",alignItems:"center",gap:14,
              }} className="card">
                <div style={{
                  width:40,height:40,borderRadius:10,flexShrink:0,
                  background:"rgba(99,102,241,.1)",border:"1px solid rgba(99,102,241,.2)",
                  display:"flex",alignItems:"center",justifyContent:"center",color:"#818cf8",
                }}>
                  <Icon d={ICONS.bookmark} size={17}/>
                </div>
                <div style={{flex:1,minWidth:0}}>
                  <p style={{fontWeight:600,fontSize:14}}>{r.label}</p>
                  <p style={{fontSize:11,color:"#475569",marginTop:1}}>{JITSI_SERVER}/{r.room}</p>
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button onClick={()=>onCopy(r.room)} style={iconBtn} title="Copy link"><Icon d={ICONS.copy} size={14}/></button>
                  <button onClick={()=>onJoin(r.room,r.label)} style={{...iconBtn,color:"#38bdf8"}} title="Join"><Icon d={ICONS.arrow} size={14}/></button>
                  <button onClick={()=>onDelete(r.id)} style={{...iconBtn,color:"#ef4444"}} title="Remove"><Icon d={ICONS.trash} size={14}/></button>
                </div>
              </div>
            ))}
          </div>
        )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
function CallTab({ call, onEnd, iframeRef }) {
  const url = meetUrl(call.room);
  return (
    <div className="fade-up" style={{display:"flex",flexDirection:"column",height:"calc(100vh - 110px)"}}>
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:12}}>
        <div>
          <h2 style={{fontFamily:"Syne",fontWeight:700,fontSize:20}}>{call.title}</h2>
          <a href={url} target="_blank" rel="noreferrer"
            style={{fontSize:11,color:"#38bdf8",textDecoration:"none"}}>
            {url} ↗
          </a>
        </div>
        <button onClick={onEnd} style={{
          background:"rgba(239,68,68,.12)",border:"1px solid rgba(239,68,68,.25)",
          color:"#fca5a5",borderRadius:8,padding:"7px 16px",fontSize:13,fontWeight:500,
          cursor:"pointer",display:"flex",alignItems:"center",gap:6,
        }} className="action-btn">
          <Icon d={ICONS.x} size={14} stroke="#fca5a5"/> End Call
        </button>
      </div>
      <div style={{flex:1,borderRadius:16,overflow:"hidden",border:"1px solid #1e293b"}}>
        <iframe
          ref={iframeRef}
          src={url}
          allow="camera; microphone; fullscreen; display-capture; autoplay"
          style={{width:"100%",height:"100%",border:"none"}}
          title={call.title}
        />
      </div>
    </div>
  );
}

// ─── Shared UI ────────────────────────────────────────────────────────────────
function SectionHeader({ title, sub, noMargin }) {
  return (
    <div style={{marginBottom: noMargin ? 0 : 24}}>
      <h1 style={{fontFamily:"Syne",fontWeight:700,fontSize:22,marginBottom:4}}>{title}</h1>
      {sub && <p style={{color:"#64748b",fontSize:13}}>{sub}</p>}
    </div>
  );
}

function EmptyState({ icon, text }) {
  return (
    <div style={{
      textAlign:"center",padding:"60px 0",color:"#334155",
    }}>
      <div style={{marginBottom:14,opacity:.4}}>
        <Icon d={icon} size={40} stroke="#64748b"/>
      </div>
      <p style={{fontSize:13,color:"#475569"}}>{text}</p>
    </div>
  );
}

// ─── Style tokens ─────────────────────────────────────────────────────────────
const inputStyle = {
  width:"100%", background:"#0b0f19", border:"1px solid #1e293b",
  borderRadius:9, padding:"9px 13px", color:"#e2e8f0", fontSize:13,
  marginBottom:0, display:"block",
};
const labelStyle = { fontSize:11, fontWeight:600, color:"#64748b",
  textTransform:"uppercase", letterSpacing:".07em", display:"block", marginBottom:7 };
const primaryBtn = {
  background:"linear-gradient(135deg,#0ea5e9,#6366f1)",
  color:"#fff", borderRadius:9, padding:"9px 18px",
  fontSize:13, fontWeight:600, display:"flex", alignItems:"center", gap:7,
  cursor:"pointer", border:"none",
};
const ghostBtn = {
  background:"rgba(255,255,255,.04)", border:"1px solid #1e293b",
  color:"#94a3b8", borderRadius:9, padding:"9px 14px",
  fontSize:13, fontWeight:500, display:"flex", alignItems:"center", gap:7,
  cursor:"pointer",
};
const iconBtn = {
  width:32, height:32, borderRadius:8, background:"rgba(255,255,255,.04)",
  border:"1px solid #1e293b", color:"#64748b",
  display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer",
  transition:"all .15s",
};

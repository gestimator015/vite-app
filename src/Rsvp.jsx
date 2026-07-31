import { useState, useEffect } from "react";

function formatParticipantEmail(email, privacyMode = 'full') {
  if (privacyMode === 'masked') return email.replace(/(.{1}).+(@.+)/, '$1***$2');
  if (privacyMode === 'hidden') return 'Participant';
  return email;
}

export default function Rsvp() {
  const token = new URLSearchParams(window.location.search).get('token');

  const [loading,       setLoading]       = useState(true);
  const [error,         setError]         = useState(null);
  const [meeting,       setMeeting]       = useState(null);
  const [status,        setStatus]        = useState('pending');
  const [submitting,    setSubmitting]    = useState(false);
  const [lastConfirmed, setLastConfirmed] = useState(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid invitation link');
      setLoading(false);
      return;
    }
    fetch('/api/rsvp?token=' + token)
      .then(r => r.json())
      .then(data => {
        if (data.error) { setError(data.error); }
        else { setMeeting(data); setStatus(data.currentStatus); }
      })
      .catch(() => setError('Could not load meeting details'))
      .finally(() => setLoading(false));
  }, []);

  async function respond(response) {
    setSubmitting(true);
    try {
      const r    = await fetch('/api/rsvp', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token, response }),
      });
      const data = await r.json();
      if (data.ok) { setStatus(data.status); setLastConfirmed(data.status); }
    } finally {
      setSubmitting(false);
    }
  }

  const formatDateTime = (iso) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
    }) + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };

  const center = { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#ffffff', fontFamily: "'DM Sans','Segoe UI',sans-serif", color: '#1a2e1a', padding: 24 };

  if (loading) {
    return <div style={center}><p style={{ color: '#4a6741', fontSize: 15 }}>Loading…</p></div>;
  }

  if (error) {
    return (
      <div style={center}>
        <div style={{ textAlign: 'center', maxWidth: 380 }}>
          <div style={{ width: 48, height: 48, borderRadius: 14, background: '#0F6E56', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', fontSize: 22 }}>📅</div>
          <p style={{ fontWeight: 700, fontSize: 18, marginBottom: 8 }}>Invitation not found</p>
          <p style={{ color: '#4a6741', fontSize: 14 }}>{error}</p>
        </div>
      </div>
    );
  }

  const isAccepted = status === 'accepted';
  const isDeclined = status === 'declined';

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', fontFamily: "'DM Sans','Segoe UI',sans-serif", color: '#1a2e1a' }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600&family=Syne:wght@700;800&display=swap');
        *{box-sizing:border-box;margin:0;padding:0;}
        body{background:#ffffff;}
        .rsvp-btn{transition:all .18s;cursor:pointer;border:none;border-radius:10px;padding:11px 28px;font-size:14px;font-weight:600;}
        .rsvp-btn:hover:not(:disabled){filter:brightness(1.08);transform:translateY(-1px);}
        .rsvp-btn:disabled{opacity:.6;cursor:not-allowed;}
      `}</style>

      {/* Header */}
      <div style={{ background: '#0F6E56', padding: '18px 0', textAlign: 'center' }}>
        <span style={{ fontFamily: 'Syne', fontWeight: 800, fontSize: 20, color: '#ffffff', letterSpacing: '.3px' }}>Videoconferencing</span>
        <div style={{ fontSize: 9, color: '#ffffff', opacity: 0.6, marginTop: 2, letterSpacing: '.5px' }}>beta version</div>
      </div>

      <div style={{ maxWidth: 480, margin: '0 auto', padding: '32px 24px' }}>

        {/* Meeting card */}
        <div style={{ background: '#f8faf8', border: '1px solid #d0e8d8', borderRadius: 16, padding: '28px 24px', marginBottom: 20 }}>
          <p style={{ fontFamily: 'Syne', fontWeight: 700, fontSize: 20, color: '#1a2e1a', marginBottom: 8 }}>{meeting.meetingTitle}</p>
          <p style={{ fontSize: 13, color: '#4a6741', marginBottom: meeting.joinLink ? 20 : 0 }}>{formatDateTime(meeting.scheduledAt)}</p>
          {meeting.joinLink && (
            <a href={meeting.joinLink}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#0F6E56', color: '#ffffff', textDecoration: 'none', padding: '10px 20px', borderRadius: 9, fontSize: 14, fontWeight: 600 }}>
              Join Meeting →
            </a>
          )}
        </div>

        {/* RSVP section */}
        <div style={{ background: '#f8faf8', border: '1px solid #d0e8d8', borderRadius: 16, padding: '24px', marginBottom: 20 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#4a6741', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 14 }}>Will you attend?</p>
          <div style={{ display: 'flex', gap: 10, marginBottom: lastConfirmed ? 16 : 0 }}>
            <button
              className="rsvp-btn"
              disabled={submitting}
              onClick={() => respond('accepted')}
              style={{
                background: isAccepted ? '#0F6E56' : '#e8f5f0',
                color:      isAccepted ? '#ffffff'  : '#0F6E56',
                border:     isAccepted ? 'none'     : '1px solid #c8e6d8',
              }}>
              ✓ Accept
            </button>
            <button
              className="rsvp-btn"
              disabled={submitting}
              onClick={() => respond('declined')}
              style={{
                background: isDeclined ? '#b91c1c' : '#fef2f2',
                color:      isDeclined ? '#ffffff'  : '#b91c1c',
                border:     isDeclined ? 'none'     : '1px solid #fecaca',
              }}>
              ✗ Decline
            </button>
          </div>
          {lastConfirmed && (
            <div>
              <p style={{ fontSize: 14, fontWeight: 600, color: lastConfirmed === 'accepted' ? '#0F6E56' : '#b91c1c' }}>
                {lastConfirmed === 'accepted' ? 'Meeting accepted ✓' : 'Meeting declined ✗'}
              </p>
              <p style={{ fontSize: 12, color: '#7a9e7a', marginTop: 4 }}>You can change your response above.</p>
            </div>
          )}
        </div>

        {/* Participants section */}
        {meeting.participants?.length > 0 && (
          <div style={{ background: '#f8faf8', border: '1px solid #d0e8d8', borderRadius: 16, padding: '24px' }}>
            <p style={{ fontSize: 12, fontWeight: 600, color: '#4a6741', textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 14 }}>
              Participants ({meeting.participants.length})
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {meeting.participants.map((p, i) => (
                <div key={i} style={{ fontSize: 13, color: '#1a2e1a' }}>
                  {formatParticipantEmail(p.email, 'full')}
                  <span style={{ color: '#7a9e7a', marginLeft: 6, fontSize: 12 }}>
                    · added {new Date(p.addedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <p style={{ textAlign: 'center', fontSize: 11, color: '#d0e8d8', marginTop: 28 }}>
          Powered by Videoconferencing · Jitsi as a Service
        </p>
      </div>
    </div>
  );
}

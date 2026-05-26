const BREVO_API_URL = 'https://api.brevo.com/v3/smtp/email';
const SENDER_NAME   = 'MeetHub';
const SENDER_EMAIL  = 'noreply@meethubapp.com';
const MAX_GUESTS    = 20;

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }) + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function formatDatePT(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  }) + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function buildHtml({ meetingTitle, meetingDate, joinLink, password }) {
  const dateEN = formatDate(meetingDate);
  const datePT = formatDatePT(meetingDate);

  const passwordBlockEN = password
    ? `<p><strong>Password:</strong> ${password}</p>`
    : `<p>No password required.</p>`;
  const passwordBlockPT = password
    ? `<p><strong>Senha:</strong> ${password}</p>`
    : `<p>Nenhuma senha necessária.</p>`;

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
    <div style="background:#0F6E56;padding:28px 32px;">
      <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:.3px;">MeetHub</p>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;font-size:20px;color:#1a2e1a;">You're invited to a meeting</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#4a6741;">You've been invited to join the following meeting:</p>

      <div style="background:#f8faf8;border:1px solid #d0e8d8;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a2e1a;">${meetingTitle}</p>
        <p style="margin:0 0 12px;font-size:14px;color:#4a6741;">${dateEN}</p>
        ${passwordBlockEN}
      </div>

      <a href="${joinLink}" style="display:inline-block;background:#0F6E56;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:15px;font-weight:600;margin-bottom:20px;">Join Meeting</a>

      <p style="font-size:12px;color:#7a9e7a;word-break:break-all;">Or copy this link: ${joinLink}</p>

      <hr style="border:none;border-top:1px solid #e4ede4;margin:28px 0;">

      <h2 style="margin:0 0 8px;font-size:20px;color:#1a2e1a;">Você foi convidado para uma reunião</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#4a6741;">Você foi convidado para participar da seguinte reunião:</p>

      <div style="background:#f8faf8;border:1px solid #d0e8d8;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a2e1a;">${meetingTitle}</p>
        <p style="margin:0 0 12px;font-size:14px;color:#4a6741;">${datePT}</p>
        ${passwordBlockPT}
      </div>

      <a href="${joinLink}" style="display:inline-block;background:#0F6E56;color:#ffffff;text-decoration:none;padding:13px 28px;border-radius:10px;font-size:15px;font-weight:600;margin-bottom:20px;">Entrar na Reunião</a>

      <p style="font-size:12px;color:#7a9e7a;word-break:break-all;">Ou copie este link: ${joinLink}</p>
    </div>
    <div style="background:#f8faf8;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#7a9e7a;">Powered by MeetHub · Jitsi as a Service</p>
    </div>
  </div>
</body>
</html>`.trim();
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const { guestEmails, hostEmail, meetingTitle, meetingDate, roomCode, password } = req.body;

  if (!Array.isArray(guestEmails) || guestEmails.length === 0) {
    return res.status(400).json({ error: 'No guest emails provided' });
  }
  if (guestEmails.length > MAX_GUESTS) {
    return res.status(400).json({ error: 'Too many guests' });
  }

  const publicUrl = process.env.VITE_PUBLIC_URL || '';
  const joinLink  = `${publicUrl}/join/${roomCode}`;
  const subject   = `You're invited to ${meetingTitle} / Você foi convidado para ${meetingTitle}`;
  const htmlContent = buildHtml({ meetingTitle, meetingDate, joinLink, password });

  const errors = [];
  let sent = 0;

  for (const guestEmail of guestEmails) {
    try {
      const response = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: {
          'api-key': BREVO_API_KEY,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sender:    { name: SENDER_NAME, email: SENDER_EMAIL },
          replyTo:   { email: hostEmail },
          to:        [{ email: guestEmail }],
          subject,
          htmlContent,
        }),
      });
      if (!response.ok) {
        const text = await response.text();
        errors.push({ email: guestEmail, status: response.status, detail: text });
      } else {
        sent++;
      }
    } catch (err) {
      errors.push({ email: guestEmail, detail: err.message });
    }
  }

  if (sent === 0) {
    return res.status(500).json({ success: false, errors });
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, sent, ...(errors.length ? { errors } : {}) });
}

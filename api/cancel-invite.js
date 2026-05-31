const BREVO_API_URL             = 'https://api.brevo.com/v3/smtp/email';
const SENDER_NAME               = 'Metroa I.S.';
const SENDER_EMAIL              = 'gustavogrellavieira@gmail.com';
const MAX_GUESTS                = 20;
const DEFAULT_MEETING_DURATION_MS = 60 * 60 * 1000;

function toIcsDate(ms) {
  return new Date(ms).toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

function formatDate(iso, tz) {
  const d = new Date(iso);
  const opts = tz ? { timeZone: tz } : {};
  return d.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', ...opts,
  }) + ' at ' + d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', ...opts });
}

function formatDatePT(iso, tz) {
  const d = new Date(iso);
  const opts = tz ? { timeZone: tz } : {};
  return d.toLocaleDateString('pt-BR', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', ...opts,
  }) + ' às ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', ...opts });
}

function generateCancelIcs(title, dateIso, roomCode, sequence, endTime) {
  const start    = new Date(dateIso).getTime();
  const dtstart  = toIcsDate(start);
  const end      = endTime ? new Date(endTime).getTime() : start + DEFAULT_MEETING_DURATION_MS;
  const dtend    = toIcsDate(end);
  const dtstamp  = toIcsDate(Date.now());

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//MeetHub//EN',
    'METHOD:CANCEL',
    'BEGIN:VEVENT',
    `DTSTART:${dtstart}`,
    `DTEND:${dtend}`,
    `DTSTAMP:${dtstamp}`,
    `ORGANIZER;CN=${SENDER_NAME}:mailto:${SENDER_EMAIL}`,
    `SEQUENCE:${sequence}`,
    'STATUS:CANCELLED',
    `SUMMARY:${title}`,
    `UID:${roomCode}@meethub`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}

function buildGuestCancelHtml({ hostName, displayTitle, meetingDate, tz }) {
  const dateEN = formatDate(meetingDate, tz);
  const datePT = formatDatePT(meetingDate, tz);

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
    <div style="background:#b91c1c;padding:28px 32px;">
      <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:.3px;">MeetHub</p>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;font-size:20px;color:#1a2e1a;">Meeting Cancelled</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#4a6741;">${hostName} has cancelled the following meeting:</p>

      <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a2e1a;text-decoration:line-through;">${displayTitle}</p>
        <p style="margin:0;font-size:14px;color:#4a6741;">${dateEN}</p>
      </div>

      <p style="font-size:13px;color:#7a9e7a;">This event has been removed from your calendar.</p>

      <hr style="border:none;border-top:1px solid #e4ede4;margin:28px 0;">

      <h2 style="margin:0 0 8px;font-size:20px;color:#1a2e1a;">Reunião Cancelada</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#4a6741;">${hostName} cancelou a seguinte reunião:</p>

      <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a2e1a;text-decoration:line-through;">${displayTitle}</p>
        <p style="margin:0;font-size:14px;color:#4a6741;">${datePT}</p>
      </div>

      <p style="font-size:13px;color:#7a9e7a;">Este evento foi removido do seu calendário.</p>
    </div>
    <div style="background:#f8faf8;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#7a9e7a;">Powered by MeetHub · Jitsi as a Service</p>
    </div>
  </div>
</body>
</html>`;
}

function buildHostCancelHtml({ displayTitle, meetingDate, guestEmails, tz }) {
  const dateEN    = formatDate(meetingDate, tz);
  const datePT    = formatDatePT(meetingDate, tz);
  const hasGuests = guestEmails.length > 0;
  const guestList = hasGuests ? guestEmails.join(', ') : null;

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="font-family:'Segoe UI',Arial,sans-serif;background:#f4f4f4;margin:0;padding:24px;">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08);">
    <div style="background:#b91c1c;padding:28px 32px;">
      <p style="margin:0;font-size:22px;font-weight:800;color:#ffffff;letter-spacing:.3px;">MeetHub</p>
    </div>
    <div style="padding:32px;">
      <h2 style="margin:0 0 8px;font-size:20px;color:#1a2e1a;">You cancelled a meeting</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#4a6741;">${hasGuests ? 'Your guests have been notified.' : 'There were no guests to notify.'}</p>

      <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a2e1a;text-decoration:line-through;">${displayTitle}</p>
        <p style="margin:0 0 12px;font-size:14px;color:#4a6741;">${dateEN}</p>
        ${hasGuests ? `<p style="margin:0;font-size:13px;color:#4a6741;"><strong>Guests notified:</strong> ${guestList}</p>` : ''}
      </div>

      <hr style="border:none;border-top:1px solid #e4ede4;margin:28px 0;">

      <h2 style="margin:0 0 8px;font-size:20px;color:#1a2e1a;">Você cancelou uma reunião</h2>
      <p style="margin:0 0 24px;font-size:14px;color:#4a6741;">${hasGuests ? 'Seus convidados foram notificados.' : 'Não havia convidados para notificar.'}</p>

      <div style="background:#fff5f5;border:1px solid #fecaca;border-radius:10px;padding:20px 24px;margin-bottom:24px;">
        <p style="margin:0 0 8px;font-size:18px;font-weight:700;color:#1a2e1a;text-decoration:line-through;">${displayTitle}</p>
        <p style="margin:0 0 12px;font-size:14px;color:#4a6741;">${datePT}</p>
        ${hasGuests ? `<p style="margin:0;font-size:13px;color:#4a6741;"><strong>Convidados notificados:</strong> ${guestList}</p>` : ''}
      </div>
    </div>
    <div style="background:#f8faf8;padding:16px 32px;text-align:center;">
      <p style="margin:0;font-size:11px;color:#7a9e7a;">Powered by MeetHub · Jitsi as a Service</p>
    </div>
  </div>
</body>
</html>`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const BREVO_API_KEY = process.env.BREVO_API_KEY;
  if (!BREVO_API_KEY) {
    return res.status(500).json({ error: 'Email service not configured' });
  }

  const { guestEmails, hostEmail, hostName: rawHostName, meetingTitle,
          guestTitle, meetingDate, endTime, roomCode,
          ics_sequence: rawSequence, timezone } = req.body;
  const hostName     = rawHostName || hostEmail;
  const sequence     = Number.isInteger(rawSequence) && rawSequence >= 0 ? rawSequence : 0;
  const displayTitle = guestTitle || meetingTitle;

  if (!Array.isArray(guestEmails)) {
    return res.status(400).json({ error: 'guestEmails must be an array' });
  }
  if (guestEmails.length > MAX_GUESTS) {
    return res.status(400).json({ error: 'Too many guests' });
  }

  const icsString  = generateCancelIcs(displayTitle, meetingDate, roomCode, sequence, endTime);
  const icsBase64  = Buffer.from(icsString).toString('base64');
  const attachment = [{ content: icsBase64, name: 'cancel.ics' }];

  const errors = [];
  let sent = 0;

  for (const guestEmail of guestEmails) {
    try {
      const guestHtml    = buildGuestCancelHtml({ hostName, displayTitle, meetingDate, tz: timezone });
      const guestSubject = `Meeting Cancelled: ${displayTitle} / Reunião Cancelada: ${displayTitle}`;
      const response     = await fetch(BREVO_API_URL, {
        method: 'POST',
        headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender:      { name: SENDER_NAME, email: SENDER_EMAIL },
          replyTo:     { email: hostEmail },
          to:          [{ email: guestEmail }],
          subject:     guestSubject,
          htmlContent: guestHtml,
          attachment,
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

  // Send confirmation to host (always, even when guest list is empty)
  let hostEmailSent = false;
  try {
    const hostHtml = buildHostCancelHtml({ displayTitle, meetingDate, guestEmails, tz: timezone });
    const hostRes  = await fetch(BREVO_API_URL, {
      method: 'POST',
      headers: { 'api-key': BREVO_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sender:      { name: SENDER_NAME, email: SENDER_EMAIL },
        to:          [{ email: hostEmail }],
        subject:     `You cancelled: ${displayTitle} / Você cancelou: ${displayTitle}`,
        htmlContent: hostHtml,
        attachment,
      }),
    });
    hostEmailSent = hostRes.ok;
  } catch {
    hostEmailSent = false;
  }

  res.setHeader('Cache-Control', 'no-store');
  res.json({ success: true, sent, hostEmailSent, ...(errors.length ? { errors } : {}) });
}

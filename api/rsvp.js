import { createClient } from "@supabase/supabase-js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
  if (req.method !== "GET" && req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const supabaseUrl        = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // ── GET ────────────────────────────────────────────────────────────────────
  if (req.method === "GET") {
    const token = req.query.token;
    if (!token || !UUID_RE.test(token)) {
      return res.status(400).json({ error: "Missing or invalid token" });
    }

    const { data: guest, error: guestErr } = await supabase
      .from("meeting_guests")
      .select("scheduled_meeting_id, rsvp_status")
      .eq("rsvp_token", token)
      .maybeSingle();

    if (guestErr || !guest) {
      return res.status(404).json({ error: "Invalid or expired link" });
    }

    if (!guest.scheduled_meeting_id) {
      return res.status(404).json({ error: "Invalid or expired link" });
    }

    const { data: meeting, error: meetingErr } = await supabase
      .from("scheduled_meetings")
      .select("title, guest_title, scheduled_at, end_time, room_code")
      .eq("id", guest.scheduled_meeting_id)
      .maybeSingle();

    if (meetingErr || !meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    const { data: guestList } = await supabase
      .from("meeting_guests")
      .select("email, created_at")
      .eq("scheduled_meeting_id", guest.scheduled_meeting_id)
      .order("created_at", { ascending: true });

    return res.status(200).json({
      meetingTitle:  meeting.guest_title || meeting.title,
      scheduledAt:   meeting.scheduled_at,
      endTime:       meeting.end_time,
      joinLink:      `${process.env.VITE_PUBLIC_URL || 'https://vite-app-azure.vercel.app'}/join/${meeting.room_code}`,
      currentStatus: guest.rsvp_status,
      participants:  (guestList ?? []).map(p => ({ email: p.email, addedAt: p.created_at })),
    });
  }

  // ── POST ───────────────────────────────────────────────────────────────────
  const { token, response } = req.body || {};

  if (!token || !UUID_RE.test(token) || (response !== "accepted" && response !== "declined")) {
    return res.status(400).json({ error: "Invalid token or response value" });
  }

  const { data, error } = await supabase
    .from("meeting_guests")
    .update({ rsvp_status: response, rsvp_responded_at: new Date().toISOString() })
    .eq("rsvp_token", token)
    .select("rsvp_status")
    .maybeSingle();

  if (error || !data) {
    return res.status(404).json({ error: "Invalid or expired link" });
  }

  return res.status(200).json({ ok: true, status: data.rsvp_status });
}

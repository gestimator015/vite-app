import { SignJWT, importPKCS8 } from "jose";
import { createClient } from "@supabase/supabase-js";

export default async function handler(req, res) {
  const { room = "*", name = "Guest", email = "", password = "" } = req.query;

  const appId      = process.env.VITE_JAAS_APP_ID;
  const keyId      = process.env.VITE_JAAS_KEY_ID;
  const rawKey     = process.env.JAAS_PRIVATE_KEY;

  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  const missing = [
    !appId  && "VITE_JAAS_APP_ID",
    !keyId  && "VITE_JAAS_KEY_ID",
    !rawKey && "JAAS_PRIVATE_KEY",
  ].filter(Boolean);
  if (missing.length) {
    return res.status(500).json({ error: "Missing environment variables", missing });
  }

  if (room && room !== "*") {
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      console.log("DEBUG room:", room);

      const { data: recurring } = await supabase
        .from("recurring_meetings")
        .select("room_password")
        .eq("room_code", room)
        .maybeSingle();

      const { data: scheduled } = await supabase
        .from("scheduled_meetings")
        .select("room_password")
        .eq("room_code", room)
        .maybeSingle();

      const record = recurring || scheduled;
      console.log("DEBUG recurring:", JSON.stringify(recurring));
      console.log("DEBUG scheduled:", JSON.stringify(scheduled));
      console.log("DEBUG record:", JSON.stringify(record));
      console.log("DEBUG supabaseUrl:", supabaseUrl ? "present" : "missing");
      console.log("DEBUG supabaseServiceKey:", supabaseServiceKey ? "present" : "missing");

      if (record && record.room_password) {
        if (!password || password !== record.room_password) {
          return res.status(401).json({ error: "Invalid meeting password" });
        }
      }
    }
  }

  // Vercel stores multi-line secrets with literal \n — restore real newlines
  const pem = rawKey.replace(/\\n/g, "\n");

  let privateKey;
  try {
    privateKey = await importPKCS8(pem, "RS256");
  } catch {
    return res.status(500).json({ error: "Invalid JAAS_PRIVATE_KEY format" });
  }

  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    iss: "chat",
    aud: "jitsi",
    sub: appId,
    room,
    context: {
      user: {
        moderator: true,
        name,
        id: `user-${now}`,
        avatar: "",
        email,
      },
      features: {
        livestreaming: false,
        "outbound-call": false,
        "sip-outbound-call": false,
        transcription: false,
        recording: false,
      },
      room: {
        regex: false,
        ...(password && { password }),
      },
    },
  })
    .setProtectedHeader({ alg: "RS256", kid: keyId })
    .setIssuedAt(now)
    .setNotBefore(now - 10)
    .setExpirationTime(now + 3600)
    .sign(privateKey);

  res.setHeader("Cache-Control", "no-store");
  res.json({ token });
}

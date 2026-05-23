import { SignJWT, importPKCS8 } from "jose";

export default async function handler(req, res) {
  const { room = "*", name = "Guest", email = "" } = req.query;

  const appId      = process.env.VITE_JAAS_APP_ID;
  const keyId      = process.env.VITE_JAAS_KEY_ID;
  const rawKey     = process.env.JAAS_PRIVATE_KEY;

  if (!appId || !keyId || !rawKey) {
    return res.status(500).json({ error: "JaaS environment variables not configured" });
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

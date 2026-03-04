const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

function res(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") return res(200, { ok: true });
  if (event.httpMethod !== "POST") return res(405, { error: "Method not allowed" });

  try {
    const { parola } = JSON.parse(event.body || "{}");
    if (!parola) return res(400, { error: "Lipsește parola." });

    const hash = process.env.ADMIN_PASSWORD_HASH;
    const secret = process.env.JWT_SECRET;

    if (!hash || !secret) {
      return res(500, { error: "Server misconfigured (missing env vars)." });
    }

    const ok = await bcrypt.compare(parola, hash);
    if (!ok) return res(401, { error: "Parolă greșită." });

    const token = jwt.sign({ role: "admin" }, secret, { expiresIn: "7d" });
    return res(200, { token });
  } catch (e) {
    return res(500, { error: "Eroare server.", details: String(e?.message || e) });
  }
};

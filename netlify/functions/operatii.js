const jwt = require("jsonwebtoken");
const { getStore } = require("@netlify/blobs");

// Numele colecției (store) și cheia unde ținem lista de operații
const STORE_NAME = "calculator-ore";
const KEY = "operatii_v1.json";

function res(statusCode, body) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type, Authorization",
      "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    },
    body: JSON.stringify(body),
  };
}

function requireAdmin(event) {
  const auth = event.headers.authorization || event.headers.Authorization;
  if (!auth || !auth.startsWith("Bearer ")) throw new Error("UNAUTHORIZED");

  const token = auth.slice("Bearer ".length);
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Missing JWT_SECRET");

  const payload = jwt.verify(token, secret);
  if (payload?.role !== "admin") throw new Error("UNAUTHORIZED");
}

function randomId() {
  // id scurt și safe pt URL
  return "op_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

async function readOperatii(store) {
  const raw = await store.get(KEY, { type: "text" });
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

async function writeOperatii(store, operatii) {
  await store.set(KEY, JSON.stringify(operatii));
}

exports.handler = async (event, context) => {
  if (event.httpMethod === "OPTIONS") return res(200, { ok: true });

  try {
    // Store legat de site-ul tău Netlify (persistă global)
    const store = getStore({ name: STORE_NAME, siteID: context.site?.id });

    // PUBLIC: listă operații
    if (event.httpMethod === "GET") {
      const operatii = await readOperatii(store);
      // sort desc by created_at
      operatii.sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
      return res(200, { operatii });
    }

    // ADMIN: adaugă
    if (event.httpMethod === "POST") {
      requireAdmin(event);

      const { denumire, valoare } = JSON.parse(event.body || "{}");
      if (!denumire || typeof denumire !== "string") return res(400, { error: "Denumire invalidă." });

      const v = Number(valoare);
      if (!Number.isFinite(v) || v <= 0) return res(400, { error: "Valoare invalidă." });

      const operatii = await readOperatii(store);

      const operatie = {
        id: randomId(),
        denumire: denumire.trim(),
        valoare: v,
        created_at: Date.now()
      };

      operatii.push(operatie);
      await writeOperatii(store, operatii);

      return res(200, { operatie });
    }

    // ADMIN: șterge
    if (event.httpMethod === "DELETE") {
      requireAdmin(event);

      const id = event.queryStringParameters?.id;
      if (!id) return res(400, { error: "Lipsește id." });

      const operatii = await readOperatii(store);
      const newOps = operatii.filter(o => o.id !== id);

      if (newOps.length === operatii.length) {
        return res(404, { error: "Operația nu a fost găsită." });
      }

      await writeOperatii(store, newOps);
      return res(200, { ok: true });
    }

    return res(405, { error: "Method not allowed" });
  } catch (e) {
    if (String(e.message) === "UNAUTHORIZED") return res(401, { error: "Neautorizat." });
    return res(500, { error: "Eroare server.", details: String(e?.message || e) });
  }
};

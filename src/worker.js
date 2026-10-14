import webpush from "web-push";

const allowedStatuses = new Set(["available", "consumed", "discarded"]);
const allowedDateKinds = new Set(["caducidad", "consumo_preferente"]);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}

function fail(message, status = 400) {
  return json({ error: message }, status);
}

async function readJson(request) {
  if (Number(request.headers.get("content-length") || 0) > 16_000) throw new Error("Solicitud demasiado grande");
  return request.json();
}

async function householdId(request, env) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "") || "";
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const id = [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, "0")).join("");
  const row = await env.DB.prepare("SELECT id FROM households WHERE id = ?").bind(id).first();
  return row?.id || null;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
}

function validItem(body) {
  const name = String(body.name || "").trim().slice(0, 100);
  const quantity = Number(body.quantity);
  const unit = String(body.unit || "ud").trim().slice(0, 20);
  const expiryDate = String(body.expiry_date || "");
  const dateKind = String(body.date_kind || "caducidad");
  if (!name) throw new Error("Indica el nombre del alimento");
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) throw new Error("Cantidad no válida");
  if (!unit) throw new Error("Indica la unidad");
  if (!validDate(expiryDate)) throw new Error("Fecha no válida");
  if (!allowedDateKinds.has(dateKind)) throw new Error("Tipo de fecha no válido");
  return { name, quantity, unit, expiryDate, dateKind };
}

function safeEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return !/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|\[?::1)/.test(host);
  } catch { return false; }
}

async function routeApi(request, env, url) {
  if (url.pathname === "/api/household" && request.method === "POST") {
    const token = [...crypto.getRandomValues(new Uint8Array(32))].map((n) => n.toString(16).padStart(2, "0")).join("");
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
    const id = [...new Uint8Array(digest)].map((n) => n.toString(16).padStart(2, "0")).join("");
    await env.DB.prepare("INSERT INTO households (id) VALUES (?)").bind(id).run();
    return json({ token }, 201);
  }

  const hid = await householdId(request, env);
  if (!hid) return fail("Despensa no encontrada. Crea una nueva o abre tu enlace compartido.", 401);

  if (url.pathname === "/api/items" && request.method === "GET") {
    const result = await env.DB.prepare("SELECT id, name, quantity, unit, expiry_date, date_kind, status, created_at FROM items WHERE household_id = ? ORDER BY status, expiry_date, created_at DESC").bind(hid).all();
    return json({ items: result.results });
  }
  if (url.pathname === "/api/items" && request.method === "POST") {
    const item = validItem(await readJson(request));
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO items (id, household_id, name, quantity, unit, expiry_date, date_kind) VALUES (?, ?, ?, ?, ?, ?, ?)")
      .bind(id, hid, item.name, item.quantity, item.unit, item.expiryDate, item.dateKind).run();
    return json({ id }, 201);
  }
  const itemMatch = url.pathname.match(/^\/api\/items\/([a-f0-9-]{36})$/);
  if (itemMatch && request.method === "PATCH") {
    const body = await readJson(request);
    if (!allowedStatuses.has(body.status)) return fail("Estado no válido");
    const result = await env.DB.prepare("UPDATE items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?")
      .bind(body.status, itemMatch[1], hid).run();
    return result.meta.changes ? json({ ok: true }) : fail("Alimento no encontrado", 404);
  }
  if (itemMatch && request.method === "DELETE") {
    const result = await env.DB.prepare("DELETE FROM items WHERE id = ? AND household_id = ?").bind(itemMatch[1], hid).run();
    return result.meta.changes ? json({ ok: true }) : fail("Alimento no encontrado", 404);
  }
  if (url.pathname === "/api/push/key" && request.method === "GET") {
    return env.VAPID_PUBLIC_KEY ? json({ publicKey: env.VAPID_PUBLIC_KEY }) : fail("Notificaciones sin configurar", 503);
  }
  if (url.pathname === "/api/push/subscribe" && request.method === "POST") {
    const body = await readJson(request);
    const { endpoint, keys } = body || {};
    if (typeof endpoint !== "string" || !safeEndpoint(endpoint) || typeof keys?.p256dh !== "string" || typeof keys?.auth !== "string") return fail("Suscripción no válida");
    await env.DB.prepare("INSERT INTO push_subscriptions (endpoint, household_id, p256dh, auth) VALUES (?, ?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET household_id = excluded.household_id, p256dh = excluded.p256dh, auth = excluded.auth")
      .bind(endpoint, hid, keys.p256dh, keys.auth).run();
    return json({ ok: true });
  }
  if (url.pathname === "/api/push/test" && request.method === "POST") {
    if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return fail("Notificaciones sin configurar", 503);
    webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
    const subs = await env.DB.prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE household_id = ?").bind(hid).all();
    if (!subs.results.length) return fail("Activa las notificaciones primero");
    let sent = 0;
    for (const sub of subs.results) {
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title: "Primero esto", body: "¡Los avisos de tu despensa funcionan!", tag: "test-notification" }));
        sent++;
      } catch (error) { console.error("Push test failed", error?.statusCode || error?.message); }
    }
    return sent ? json({ sent }) : fail("No se pudo entregar el aviso de prueba", 502);
  }
  return fail("Ruta no encontrada", 404);
}

function madridDate() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

async function sendReminders(env) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return;
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  const today = madridDate();
  const end = new Date(`${today}T00:00:00Z`);
  end.setUTCDate(end.getUTCDate() + 3);
  const rows = await env.DB.prepare("SELECT i.id, i.name, i.expiry_date, i.household_id FROM items i WHERE i.status = 'available' AND i.expiry_date BETWEEN ? AND ? LIMIT 200")
    .bind(today, end.toISOString().slice(0, 10)).all();
  for (const item of rows.results) {
    const days = Math.round((Date.parse(`${item.expiry_date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
    if (![0, 1, 3].includes(days)) continue;
    const already = await env.DB.prepare("SELECT 1 FROM notification_events WHERE item_id = ? AND days_before = ?").bind(item.id, days).first();
    if (already) continue;
    const subs = await env.DB.prepare("SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE household_id = ?").bind(item.household_id).all();
    if (!subs.results.length) continue;
    let delivered = false;
    for (const sub of subs.results) {
      const message = days === 0 ? `${item.name} llega hoy a su fecha` : `${item.name} llega a su fecha en ${days} día${days === 1 ? "" : "s"}`;
      try {
        await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, JSON.stringify({ title: "Primero esto", body: message, tag: `item-${item.id}-${days}` }));
        delivered = true;
      } catch (error) {
        if ([404, 410].includes(error?.statusCode)) await env.DB.prepare("DELETE FROM push_subscriptions WHERE endpoint = ?").bind(sub.endpoint).run();
        else console.error("Push delivery failed", error?.statusCode || error?.message);
      }
    }
    if (delivered) await env.DB.prepare("INSERT OR IGNORE INTO notification_events (item_id, days_before) VALUES (?, ?)").bind(item.id, days).run();
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith("/api/")) return env.ASSETS.fetch(request);
    try { return await routeApi(request, env, url); }
    catch (error) {
      console.error(error);
      return fail(error instanceof SyntaxError ? "Datos no válidos" : error.message || "Error del servidor", error.message?.includes("no válida") ? 400 : 500);
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(sendReminders(env));
  }
};

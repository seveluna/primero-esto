import webpush from "web-push";

const allowedStatuses = new Set(["available", "consumed", "discarded"]);
const allowedDateKinds = new Set(["caducidad", "consumo_preferente"]);
const allowedCategories = new Set(["frutas_verduras", "carniceria", "pescaderia", "charcuteria", "lacteos_huevos", "panaderia", "despensa", "congelados", "bebidas", "otros"]);

function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", ...headers }
  });
}

function fail(message, status = 400) {
  return json({ error: message }, status);
}

async function readJson(request) {
  if (Number(request.headers.get("content-length") || 0) > 16_000) throw new Error("Solicitud demasiado grande");
  return request.json();
}

const hex = (bytes) => [...bytes].map((n) => n.toString(16).padStart(2, "0")).join("");
const randomToken = () => hex(crypto.getRandomValues(new Uint8Array(32)));
const nowSeconds = () => Math.floor(Date.now() / 1000);

async function hashToken(token) {
  return hex(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token))));
}

function cookieToken(request) {
  return request.headers.get("cookie")?.match(/(?:^|;\s*)__Host-pe_session=([a-f0-9]{64})(?:;|$)/)?.[1] || "";
}

async function sessionUser(request, env) {
  const token = cookieToken(request);
  if (!token) return null;
  return env.DB.prepare("SELECT u.id, u.email, u.household_id FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = ? AND s.expires_at > ?")
    .bind(await hashToken(token), nowSeconds()).first();
}

async function bearerHousehold(request, env) {
  const token = request.headers.get("authorization")?.replace(/^Bearer /i, "") || "";
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const digest = await hashToken(token);
  const row = await env.DB.prepare("SELECT id FROM households WHERE id = ? AND NOT EXISTS (SELECT 1 FROM claimed_households WHERE household_id = id)").bind(digest).first();
  if (row) return row.id;
  const link = await env.DB.prepare("SELECT household_id FROM household_links WHERE token_hash = ?").bind(digest).first();
  return link?.household_id || null;
}

async function householdId(request, env) {
  return await bearerHousehold(request, env) || (await sessionUser(request, env))?.household_id || null;
}

async function passwordHash(password, saltHex) {
  const salt = Uint8Array.from(saltHex.match(/../g), (pair) => parseInt(pair, 16));
  const firstKey = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const firstPass = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, firstKey, 256);
  const secondKey = await crypto.subtle.importKey("raw", firstPass, "PBKDF2", false, ["deriveBits"]);
  return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" }, secondKey, 256)));
}

function equalHex(left, right) {
  if (left.length !== right.length) return false;
  let difference = 0;
  for (let i = 0; i < left.length; i++) difference |= left.charCodeAt(i) ^ right.charCodeAt(i);
  return difference === 0;
}

function sessionCookie(token, maxAge) {
  return `__Host-pe_session=${token}; Path=/; Max-Age=${maxAge}; Secure; HttpOnly; SameSite=Lax`;
}

async function authRoute(request, env, url) {
  const path = url.pathname;
  if (path === "/api/auth/me" && request.method === "GET") {
    const user = await sessionUser(request, env);
    return json({ user: user ? { email: user.email } : null });
  }
  if (path === "/api/auth/register" && request.method === "POST") {
    const body = await readJson(request);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return fail("Correo no válido");
    if (password.length < 12 || password.length > 128) return fail("La contraseña debe tener entre 12 y 128 caracteres");
    if (await env.DB.prepare("SELECT 1 FROM users WHERE email = ?").bind(email).first()) return fail("Ese correo ya tiene una cuenta", 409);
    const guestToken = String(body.guest_token || "");
    const guestId = /^[a-f0-9]{64}$/.test(guestToken) ? await hashToken(guestToken) : null;
    const guest = guestId && await env.DB.prepare("SELECT id FROM households WHERE id = ? AND NOT EXISTS (SELECT 1 FROM claimed_households WHERE household_id = id)").bind(guestId).first();
    if (guestId && !guest) return fail("No se pudo vincular la despensa actual. Actualiza la página e inténtalo de nuevo.", 409);
    const household = guest?.id || randomToken();
    const salt = hex(crypto.getRandomValues(new Uint8Array(16)));
    const passHash = await passwordHash(password, salt);
    const userId = crypto.randomUUID();
    const session = randomToken();
    const statements = [];
    if (!guest) statements.push(env.DB.prepare("INSERT INTO households (id) VALUES (?)").bind(household));
    statements.push(env.DB.prepare("INSERT INTO claimed_households (household_id) VALUES (?)").bind(household));
    statements.push(env.DB.prepare("INSERT INTO users (id, email, salt, password_hash, household_id) VALUES (?, ?, ?, ?, ?)").bind(userId, email, salt, passHash, household));
    statements.push(env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(await hashToken(session), userId, nowSeconds() + 30 * 86400));
    await env.DB.batch(statements);
    return json({ user: { email } }, 201, { "set-cookie": sessionCookie(session, 30 * 86400) });
  }
  if (path === "/api/auth/login" && request.method === "POST") {
    const body = await readJson(request);
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (email.length > 254 || password.length > 128) return fail("Correo o contraseña incorrectos", 401);
    const key = await hashToken(`${request.headers.get("cf-connecting-ip") || "unknown"}:${email}`);
    const now = nowSeconds();
    const attempt = await env.DB.prepare("SELECT attempts, window_start FROM login_attempts WHERE attempt_key = ?").bind(key).first();
    if (attempt && now - attempt.window_start < 900 && attempt.attempts >= 8) return fail("Demasiados intentos. Prueba de nuevo en 15 minutos.", 429);
    const user = await env.DB.prepare("SELECT id, email, salt, password_hash FROM users WHERE email = ?").bind(email).first();
    const computed = await passwordHash(password, user?.salt || "00000000000000000000000000000000");
    if (!user || !equalHex(computed, user.password_hash)) {
      await env.DB.prepare("INSERT INTO login_attempts (attempt_key, attempts, window_start) VALUES (?, 1, ?) ON CONFLICT(attempt_key) DO UPDATE SET attempts = CASE WHEN ? - window_start >= 900 THEN 1 ELSE attempts + 1 END, window_start = CASE WHEN ? - window_start >= 900 THEN ? ELSE window_start END").bind(key, now, now, now, now).run();
      return fail("Correo o contraseña incorrectos", 401);
    }
    await env.DB.prepare("DELETE FROM login_attempts WHERE attempt_key = ?").bind(key).run();
    const session = randomToken();
    await env.DB.prepare("INSERT INTO sessions (token_hash, user_id, expires_at) VALUES (?, ?, ?)").bind(await hashToken(session), user.id, now + 30 * 86400).run();
    return json({ user: { email: user.email } }, 200, { "set-cookie": sessionCookie(session, 30 * 86400) });
  }
  if (path === "/api/auth/logout" && request.method === "POST") {
    const token = cookieToken(request);
    if (token) await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await hashToken(token)).run();
    return json({ ok: true }, 200, { "set-cookie": sessionCookie("", 0) });
  }
  return null;
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
  const category = String(body.category || "otros");
  const expiryDate = String(body.expiry_date || "");
  const dateKind = String(body.date_kind || "caducidad");
  if (!name) throw new Error("Indica el nombre del alimento");
  if (!Number.isFinite(quantity) || quantity <= 0 || quantity > 10000) throw new Error("Cantidad no válida");
  if (!unit) throw new Error("Indica la unidad");
  if (!allowedCategories.has(category)) throw new Error("Categoría no válida");
  if (!validDate(expiryDate)) throw new Error("Fecha no válida");
  if (!allowedDateKinds.has(dateKind)) throw new Error("Tipo de fecha no válido");
  return { name, quantity, unit, category, expiryDate, dateKind };
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
  const authResponse = await authRoute(request, env, url);
  if (authResponse) return authResponse;
  if (url.pathname === "/api/household" && request.method === "POST") {
    const token = randomToken();
    const id = await hashToken(token);
    await env.DB.prepare("INSERT INTO households (id) VALUES (?)").bind(id).run();
    return json({ token }, 201);
  }

  if (url.pathname === "/api/share" && request.method === "POST") {
    const user = await sessionUser(request, env);
    if (!user) return fail("Inicia sesión para compartir tu despensa", 401);
    const token = randomToken();
    await env.DB.prepare("INSERT INTO household_links (token_hash, household_id) VALUES (?, ?)").bind(await hashToken(token), user.household_id).run();
    return json({ token }, 201);
  }

  const hid = await householdId(request, env);
  if (!hid) return fail("Despensa no encontrada. Crea una nueva o abre tu enlace compartido.", 401);

  if (url.pathname === "/api/items" && request.method === "GET") {
    const result = await env.DB.prepare("SELECT id, name, quantity, unit, category, expiry_date, date_kind, status, created_at FROM items WHERE household_id = ? ORDER BY status, expiry_date, created_at DESC").bind(hid).all();
    return json({ items: result.results });
  }
  if (url.pathname === "/api/items" && request.method === "POST") {
    const item = validItem(await readJson(request));
    const id = crypto.randomUUID();
    await env.DB.prepare("INSERT INTO items (id, household_id, name, quantity, unit, category, expiry_date, date_kind) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .bind(id, hid, item.name, item.quantity, item.unit, item.category, item.expiryDate, item.dateKind).run();
    return json({ id }, 201);
  }
  const itemMatch = url.pathname.match(/^\/api\/items\/([a-f0-9-]{36})$/);
  if (itemMatch && request.method === "PUT") {
    const item = validItem(await readJson(request));
    const result = await env.DB.prepare("UPDATE items SET name = ?, quantity = ?, unit = ?, category = ?, expiry_date = ?, date_kind = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND household_id = ?")
      .bind(item.name, item.quantity, item.unit, item.category, item.expiryDate, item.dateKind, itemMatch[1], hid).run();
    return result.meta.changes ? json({ ok: true }) : fail("Alimento no encontrado", 404);
  }
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
    const origin = request.headers.get("origin");
    if (!["GET", "HEAD", "OPTIONS"].includes(request.method) && origin && origin !== url.origin) return fail("Origen no permitido", 403);
    try { return await routeApi(request, env, url); }
    catch (error) {
      console.error(error);
      return fail(error instanceof SyntaxError ? "Datos no válidos" : error.message || "Error del servidor", error.message?.includes("no válida") ? 400 : 500);
    }
  },
  async scheduled(_event, env, ctx) {
    ctx.waitUntil(Promise.all([
      sendReminders(env),
      env.DB.prepare("DELETE FROM sessions WHERE expires_at < ?").bind(nowSeconds()).run(),
      env.DB.prepare("DELETE FROM login_attempts WHERE window_start < ?").bind(nowSeconds() - 86400).run()
    ]));
  }
};

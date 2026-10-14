const $ = (selector) => document.querySelector(selector);
const state = { token: "", items: [], filter: "available" };
const recipes = [
  { name: "Tortilla de verduras", emoji: "🍳", ingredients: ["huevo", "calabacín", "cebolla"], description: "Saltea las verduras y cuájalas con huevo. Una cena rápida de aprovechamiento.", minutes: 20 },
  { name: "Ensalada de tomate y queso", emoji: "🥗", ingredients: ["tomate", "queso"], description: "Corta y mezcla los ingredientes. Añade aceite y especias al gusto.", minutes: 10 },
  { name: "Pasta cremosa con verduras", emoji: "🍝", ingredients: ["pasta", "calabacín", "queso"], description: "Cuece la pasta y mézclala con las verduras salteadas y el queso.", minutes: 25 },
  { name: "Arroz salteado con huevo", emoji: "🍚", ingredients: ["arroz", "huevo", "zanahoria"], description: "Cuece el arroz y saltéalo con zanahoria y huevo revuelto.", minutes: 25 },
  { name: "Tostada de aguacate y huevo", emoji: "🥑", ingredients: ["pan", "aguacate", "huevo"], description: "Tuesta el pan y añade aguacate y un huevo a tu gusto.", minutes: 12 },
  { name: "Crema de calabacín", emoji: "🥣", ingredients: ["calabacín", "patata", "cebolla"], description: "Cuece las verduras y tritúralas hasta obtener una crema suave.", minutes: 30 },
  { name: "Yogur con fruta", emoji: "🥛", ingredients: ["yogur", "plátano"], description: "Corta la fruta y sírvela con el yogur. Ideal para aprovechar ambos.", minutes: 5 },
  { name: "Sándwich de queso y tomate", emoji: "🥪", ingredients: ["pan", "queso", "tomate"], description: "Monta el sándwich y tuéstalo hasta que se funda el queso.", minutes: 10 },
  { name: "Pisto sencillo", emoji: "🍲", ingredients: ["tomate", "pimiento", "calabacín", "cebolla"], description: "Corta y cocina las verduras a fuego lento hasta que estén tiernas.", minutes: 35 },
  { name: "Revuelto de champiñones", emoji: "🍄", ingredients: ["champiñón", "huevo"], description: "Saltea los champiñones y agrega los huevos batidos.", minutes: 15 },
  { name: "Sopa de verduras", emoji: "🥕", ingredients: ["zanahoria", "patata", "cebolla"], description: "Cuece las verduras en agua o caldo y sirve caliente.", minutes: 30 },
  { name: "Batido de fruta y yogur", emoji: "🍓", ingredients: ["yogur", "fresa", "plátano"], description: "Tritura la fruta con yogur hasta obtener una mezcla cremosa.", minutes: 5 }
];

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
}
function normalize(value) { return String(value).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/s\b/g, ""); }
function todayIso() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date()); }
function daysUntil(date) { return Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${todayIso()}T00:00:00Z`)) / 86_400_000); }
function prettyDate(date) { return new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`)); }
function dateAfter(days) { const date = new Date(`${todayIso()}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
function toast(message) { const node = $("#toast"); node.textContent = message; node.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => node.classList.remove("show"), 3400); }

async function api(path, options = {}) {
  const response = await fetch(path, { ...options, headers: { ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }), ...(state.token ? { authorization: `Bearer ${state.token}` } : {}), ...options.headers } });
  let data = {};
  try { data = await response.json(); } catch { /* Empty response */ }
  if (!response.ok) throw new Error(data.error || `Error ${response.status}`);
  return data;
}

async function ensureHousehold() {
  const incoming = location.hash.match(/^#h=([a-f0-9]{64})$/)?.[1];
  if (incoming) localStorage.setItem("primero-esto-household", incoming);
  state.token = incoming || localStorage.getItem("primero-esto-household") || "";
  if (!state.token) {
    const { token } = await api("/api/household", { method: "POST" });
    state.token = token;
    localStorage.setItem("primero-esto-household", token);
  }
}

function emojiFor(name) {
  const value = normalize(name);
  const entries = [["tomate","🍅"],["huevo","🥚"],["queso","🧀"],["leche","🥛"],["yogur","🥛"],["zanahoria","🥕"],["aguacate","🥑"],["pan","🍞"],["platano","🍌"],["manzana","🍎"],["fresa","🍓"],["pimiento","🫑"],["champi","🍄"],["patata","🥔"],["arroz","🍚"],["pasta","🍝"],["cebolla","🧅"],["lechuga","🥬"]];
  return entries.find(([key]) => value.includes(key))?.[1] || "🥦";
}

function dateLabel(item) {
  if (item.status === "consumed") return { text: "Aprovechado", cls: "" };
  if (item.status === "discarded") return { text: "Descartado", cls: "past" };
  const days = daysUntil(item.expiry_date);
  if (days < 0) return { text: `Fecha pasada · ${prettyDate(item.expiry_date)}`, cls: "past" };
  if (days === 0) return { text: "Fecha de hoy", cls: "today" };
  if (days === 1) return { text: "Mañana", cls: "soon" };
  if (days <= 3) return { text: `En ${days} días`, cls: "soon" };
  return { text: prettyDate(item.expiry_date), cls: "" };
}

function renderItems() {
  const available = state.items.filter((item) => item.status === "available");
  const used = state.items.filter((item) => item.status === "consumed");
  $("#countAvailable").textContent = available.length;
  $("#countSoon").textContent = available.filter((item) => daysUntil(item.expiry_date) >= 0 && daysUntil(item.expiry_date) <= 3).length;
  $("#countUsed").textContent = used.length;
  const shown = state.items.filter((item) => state.filter === "all" || (state.filter === "consumed" ? item.status === "consumed" : item.status === "available"));
  $("#itemList").innerHTML = shown.length ? shown.map((item) => {
    const date = dateLabel(item);
    return `<article class="item-row"><span class="item-glyph" aria-hidden="true">${emojiFor(item.name)}</span><div class="item-details"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)} · ${item.date_kind === "consumo_preferente" ? "Consumo preferente" : "Caducidad"} ${prettyDate(item.expiry_date)}</small></div><span class="item-date ${date.cls}">${date.text}</span><div class="item-actions">${item.status === "available" ? `<button class="icon-button" data-action="consume" data-id="${item.id}" title="Marcar como consumido" aria-label="Marcar ${escapeHtml(item.name)} como consumido">✓</button><button class="icon-button" data-action="discard" data-id="${item.id}" title="Descartar" aria-label="Descartar ${escapeHtml(item.name)}">×</button>` : `<button class="icon-button" data-action="restore" data-id="${item.id}" title="Restaurar" aria-label="Restaurar ${escapeHtml(item.name)}">↶</button>`}<button class="icon-button" data-action="delete" data-id="${item.id}" title="Eliminar" aria-label="Eliminar ${escapeHtml(item.name)}">⌫</button></div></article>`;
  }).join("") : `<div class="empty-state"><span class="empty-icon">${state.filter === "available" ? "🧺" : "✳"}</span><strong>${state.filter === "available" ? "Tu despensa empieza aquí" : "No hay alimentos en esta vista"}</strong><p>${state.filter === "available" ? "Añade un alimento y su fecha para empezar a aprovecharlo." : "Prueba con otro filtro."}</p>${state.filter === "available" ? '<button class="primary-button" id="addEmptyBtn">Añadir alimento</button><button class="sample-button" id="sampleBtn">Probar con datos de ejemplo</button>' : ""}</div>`;
}

function ingredientMatch(ingredient, items) {
  return items.find((item) => normalize(item.name).includes(normalize(ingredient)) || normalize(ingredient).includes(normalize(item.name)));
}

function renderRecipes() {
  const available = state.items.filter((item) => item.status === "available" && daysUntil(item.expiry_date) >= 0);
  if (!available.length) {
    $("#recipeList").innerHTML = '<div class="empty-state"><span class="empty-icon">🍽️</span><strong>Las recetas llegarán con tus alimentos</strong><p>Añade productos disponibles para ver ideas adaptadas a tu despensa.</p></div>';
    return;
  }
  const ranked = recipes.map((recipe) => {
    const matched = recipe.ingredients.map((ingredient) => ingredientMatch(ingredient, available));
    const count = matched.filter(Boolean).length;
    const urgency = matched.filter(Boolean).reduce((sum, item) => sum + Math.max(0, 4 - daysUntil(item.expiry_date)), 0);
    return { ...recipe, count, missing: recipe.ingredients.filter((_, index) => !matched[index]), score: count * 10 + urgency + (count === recipe.ingredients.length ? 20 : 0) };
  }).filter((recipe) => recipe.count > 0).sort((a, b) => b.score - a.score).slice(0, 6);
  $("#recipeList").innerHTML = ranked.map((recipe) => `<article class="recipe-card"><div class="recipe-art" aria-hidden="true">${recipe.emoji}</div><div class="recipe-content"><span class="recipe-tag">${recipe.missing.length ? `${recipe.count} de ${recipe.ingredients.length} ingredientes` : "Lista para cocinar"} · ${recipe.minutes} min</span><h3>${escapeHtml(recipe.name)}</h3><p>${escapeHtml(recipe.description)}</p><div class="recipe-ingredients">Con: ${escapeHtml(recipe.ingredients.filter((ingredient) => !recipe.missing.includes(ingredient)).join(", "))}</div>${recipe.missing.length ? `<div class="recipe-missing">Te falta: ${escapeHtml(recipe.missing.join(", "))}</div>` : ""}</div></article>`).join("");
}

async function refresh() {
  const data = await api("/api/items");
  state.items = data.items;
  renderItems();
  renderRecipes();
}

function openDialog() { $("#addDialog").showModal(); $("#itemName").focus(); }
function closeDialog() { $("#addDialog").close(); }

async function saveItem(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  body.quantity = Number(body.quantity);
  const saveButton = form.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  try {
    await api("/api/items", { method: "POST", body: JSON.stringify(body) });
    form.reset(); closeDialog(); await refresh(); toast("Alimento añadido a tu despensa");
  } catch (error) { toast(error.message); }
  finally { saveButton.disabled = false; }
}

async function itemAction(button) {
  const { action, id } = button.dataset;
  if (action === "delete" && !confirm("¿Eliminar este alimento de la despensa?")) return;
  button.disabled = true;
  try {
    if (action === "delete") await api(`/api/items/${id}`, { method: "DELETE" });
    else await api(`/api/items/${id}`, { method: "PATCH", body: JSON.stringify({ status: { consume: "consumed", discard: "discarded", restore: "available" }[action] }) });
    await refresh(); toast(action === "consume" ? "¡Alimento aprovechado!" : "Despensa actualizada");
  } catch (error) { button.disabled = false; toast(error.message); }
}

async function loadSample() {
  const samples = [
    { name: "Tomate", quantity: 3, unit: "ud", expiry_date: dateAfter(1), date_kind: "caducidad" },
    { name: "Queso fresco", quantity: 1, unit: "ud", expiry_date: dateAfter(2), date_kind: "caducidad" },
    { name: "Pan", quantity: 1, unit: "ud", expiry_date: dateAfter(2), date_kind: "consumo_preferente" },
    { name: "Huevos", quantity: 4, unit: "ud", expiry_date: dateAfter(4), date_kind: "consumo_preferente" },
    { name: "Calabacín", quantity: 2, unit: "ud", expiry_date: dateAfter(1), date_kind: "caducidad" }
  ];
  try { for (const item of samples) await api("/api/items", { method: "POST", body: JSON.stringify(item) }); await refresh(); toast("Datos de ejemplo añadidos"); }
  catch (error) { toast(error.message); }
}

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  return Uint8Array.from(atob(base64), (character) => character.charCodeAt(0));
}

async function activateNotifications() {
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return toast("Este navegador no permite avisos push");
  const permission = await Notification.requestPermission();
  if (permission !== "granted") return toast("Activa el permiso de notificaciones para recibir avisos");
  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    const { publicKey } = await api("/api/push/key");
    const subscription = await registration.pushManager.getSubscription() || await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(publicKey) });
    await api("/api/push/subscribe", { method: "POST", body: JSON.stringify(subscription.toJSON()) });
    $("#notifyStatus").textContent = "Avisos activados en este dispositivo.";
    $("#notifyBtn").textContent = "Avisos activados ✓";
    toast("Recibirás avisos de los alimentos próximos a su fecha");
  } catch (error) { toast(`No se pudieron activar los avisos: ${error.message}`); }
}

function bindEvents() {
  ["#addTopBtn", "#addHeroBtn", "#addListBtn"].forEach((id) => $(id).addEventListener("click", openDialog));
  $("#itemList").addEventListener("click", (event) => { if (event.target.id === "addEmptyBtn") openDialog(); else if (event.target.id === "sampleBtn") loadSample(); else if (event.target.dataset.action) itemAction(event.target); });
  $("#closeDialog").addEventListener("click", closeDialog);
  $("#cancelDialog").addEventListener("click", closeDialog);
  $("#addForm").addEventListener("submit", saveItem);
  $("#notifyBtn").addEventListener("click", activateNotifications);
  $("#testNotifyBtn").addEventListener("click", async () => { try { await api("/api/push/test", { method: "POST" }); toast("Aviso de prueba enviado"); } catch (error) { toast(error.message); } });
  $("#shareBtn").addEventListener("click", async () => { try { await navigator.clipboard.writeText(`${location.origin}/#h=${state.token}`); toast("Enlace copiado. Cualquiera con él puede acceder a esta despensa."); } catch { toast("No se pudo copiar el enlace"); } });
  document.querySelectorAll(".filter").forEach((button) => button.addEventListener("click", () => { state.filter = button.dataset.filter; document.querySelectorAll(".filter").forEach((node) => node.classList.toggle("active", node === button)); renderItems(); }));
  $("#addDialog").addEventListener("click", (event) => { if (event.target === $("#addDialog")) closeDialog(); });
}

async function init() {
  bindEvents();
  $("#todayLabel").textContent = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" }).format(new Date());
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  try { await ensureHousehold(); await refresh(); }
  catch (error) { $("#itemList").innerHTML = `<div class="empty-state"><strong>No se pudo cargar la despensa</strong><p>${escapeHtml(error.message)}</p></div>`; toast(error.message); }
}

init();

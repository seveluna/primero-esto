const $ = (selector) => document.querySelector(selector);
const state = { token: "", user: null, authMode: "register", editId: null, shoppingId: null, items: [], shoppingItems: [], filter: "available", categoryFilter: "all" };
const categories = [
  ["frutas_verduras", "Frutas y verduras"], ["carniceria", "Carnicería"], ["pescaderia", "Pescadería"],
  ["charcuteria", "Charcutería"], ["lacteos_huevos", "Lácteos y huevos"], ["panaderia", "Panadería"],
  ["despensa", "Despensa"], ["congelados", "Congelados"], ["bebidas", "Bebidas"], ["otros", "Otros"]
];
// Conservative quality estimates for whole produce kept in a home fridge (Maine Cooperative Extension).
const produceLife = [
  { names: /\b(fresa|frambuesa|mora|arandano)\b/, days: 2 },
  { names: /\b(espinaca|acelga|rucula|canonigo)\b/, days: 2 },
  { names: /\b(calabacin|calabaza de verano)\b/, days: 2 },
  { names: /\b(brocoli)\b/, days: 3 },
  { names: /\b(esparrago|judia verde|guisante|berenjena)\b/, days: 2 },
  { names: /\b(lechuga)\b/, days: 5 },
  { names: /\b(pepino)\b/, days: 5 },
  { names: /\b(zanahoria|remolacha|rabano|nabo)\b/, days: 7 },
  { names: /\b(pimiento)\b/, days: 10 },
  { names: /\b(manzana)\b/, days: 21 },
  { names: /\b(pera|melocoton|nectarina)\b/, days: 5 },
  { names: /\b(cebolla tierna|cebolleta)\b/, days: 3 }
];
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
function addDays(dateIso, days) { const date = new Date(`${dateIso}T00:00:00Z`); date.setUTCDate(date.getUTCDate() + days); return date.toISOString().slice(0, 10); }
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
}

function requireAccount() {
  if (state.user && !state.token) return true;
  if (state.user && state.token) {
    openAuth("register");
    toast("Abre tu despensa desde Mi cuenta para modificar alimentos");
    return false;
  }
  openAuth("register");
  toast("Crea una cuenta o inicia sesión para modificar la despensa");
  return false;
}

function renderAuth() {
  const signedIn = Boolean(state.user);
  $("#accountPrompt").hidden = signedIn;
  $("#accountBtn").textContent = signedIn ? "Mi cuenta ✓" : "Entrar / registro";
  $("#authSignedOut").hidden = signedIn;
  $("#authSignedIn").hidden = !signedIn;
  if (signedIn) $("#accountEmail").textContent = state.user.email;
  $("#ownPantryBtn").hidden = !state.token;
}

function setAuthMode(mode) {
  state.authMode = mode;
  $("#authTitle").textContent = mode === "register" ? "Crear cuenta" : "Iniciar sesión";
  $("#authIntro").textContent = mode === "register" ? "Crea una cuenta para guardar y sincronizar tu despensa. Si esta despensa es tuya, se conservarán sus alimentos." : "Abre tu despensa guardada desde cualquier dispositivo.";
  $("#authSubmit").textContent = mode === "register" ? "Crear cuenta" : "Entrar";
  $("#authSwitch").textContent = mode === "register" ? "¿Ya tienes cuenta? Inicia sesión" : "¿Aún no tienes cuenta? Regístrate";
  $("#passwordHint").hidden = mode !== "register";
  $("#authForm input[name=password]").minLength = mode === "register" ? 12 : 1;
  $("#authForm input[name=password]").autocomplete = mode === "register" ? "new-password" : "current-password";
}

function openAuth(mode = "register") {
  setAuthMode(mode);
  renderAuth();
  $("#authDialog").showModal();
  if (!state.user) $("#authForm input[name=email]").focus();
}

async function submitAuth(event) {
  event.preventDefault();
  const button = $("#authSubmit");
  const fields = Object.fromEntries(new FormData(event.currentTarget).entries());
  button.disabled = true;
  try {
    const body = { ...fields, ...(state.authMode === "register" && state.token ? { guest_token: state.token } : {}) };
    const data = await api(`/api/auth/${state.authMode === "register" ? "register" : "login"}`, { method: "POST", body: JSON.stringify(body) });
    state.user = data.user;
    state.token = "";
    localStorage.removeItem("primero-esto-household");
    if (location.hash.startsWith("#h=")) history.replaceState(null, "", location.pathname + location.search);
    $("#authForm").reset();
    $("#authDialog").close();
    renderAuth();
    await refresh();
    toast(state.authMode === "register" ? "Cuenta creada. Tu despensa está sincronizada." : "Has entrado en tu despensa.");
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; }
}

async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
    state.user = null;
    state.token = "";
    localStorage.removeItem("primero-esto-household");
    if (location.hash.startsWith("#h=")) history.replaceState(null, "", location.pathname + location.search);
    $("#authDialog").close();
    clearPantry();
    renderAuth();
    toast("Sesión cerrada. Entra de nuevo para recuperar tu despensa.");
  } catch (error) { toast(error.message); }
}

function emojiFor(name) {
  const value = normalize(name);
  const entries = [["tomate","🍅"],["huevo","🥚"],["queso","🧀"],["leche","🥛"],["yogur","🥛"],["zanahoria","🥕"],["aguacate","🥑"],["pan","🍞"],["platano","🍌"],["manzana","🍎"],["fresa","🍓"],["pimiento","🫑"],["champi","🍄"],["patata","🥔"],["arroz","🍚"],["pasta","🍝"],["cebolla","🧅"],["lechuga","🥬"]];
  return entries.find(([key]) => value.includes(key))?.[1] || "🥦";
}

function itemDateKind(item) { return item.date_kind === "estimacion" ? "Fecha orientativa" : item.date_kind === "consumo_preferente" ? "Consumo preferente" : "Caducidad"; }

function dateLabel(item) {
  if (item.status === "consumed") return { text: "Agotado", cls: "" };
  if (item.status === "replenished") return { text: "Repuesto", cls: "" };
  if (item.status === "discarded") return { text: "Descartado", cls: "past" };
  const days = daysUntil(item.expiry_date);
  if (days < 0) return { text: `Fecha pasada · ${prettyDate(item.expiry_date)}`, cls: "past" };
  if (days === 0) return { text: "Fecha de hoy", cls: "today" };
  if (days === 1) return { text: "Mañana", cls: "soon" };
  if (days <= 3) return { text: `En ${days} días`, cls: "soon" };
  return { text: prettyDate(item.expiry_date), cls: "" };
}

function renderItems() {
  const canEdit = Boolean(state.user && !state.token);
  const available = state.items.filter((item) => item.status === "available");
  const used = state.items.filter((item) => item.status === "consumed");
  $("#countAvailable").textContent = available.length;
  $("#countSoon").textContent = available.filter((item) => daysUntil(item.expiry_date) >= 0 && daysUntil(item.expiry_date) <= 3).length;
  $("#countUsed").textContent = used.length;
  const shown = state.items.filter((item) =>
    (state.filter === "all" || (state.filter === "consumed" ? item.status === "consumed" : item.status === "available")) &&
    (state.categoryFilter === "all" || item.category === state.categoryFilter)
  );
  const itemRow = (item) => {
    const date = dateLabel(item);
    return `<article class="item-row"><span class="item-glyph" aria-hidden="true">${emojiFor(item.name)}</span><div class="item-details"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)} · ${itemDateKind(item)} ${prettyDate(item.expiry_date)}</small></div><span class="item-date ${date.cls}">${date.text}</span>${canEdit ? `<div class="item-actions"><button class="icon-button" data-action="edit" data-id="${item.id}" title="Editar" aria-label="Editar ${escapeHtml(item.name)}">✎</button>${item.status === "available" ? `<button class="icon-button" data-action="consume" data-id="${item.id}" title="Marcar como agotado" aria-label="Marcar ${escapeHtml(item.name)} como agotado">✓</button><button class="icon-button" data-action="discard" data-id="${item.id}" title="Descartar" aria-label="Descartar ${escapeHtml(item.name)}">×</button>` : item.status === "replenished" ? "" : `<button class="icon-button" data-action="restore" data-id="${item.id}" title="Restaurar" aria-label="Restaurar ${escapeHtml(item.name)}">↶</button>`}<button class="icon-button" data-action="delete" data-id="${item.id}" title="Eliminar" aria-label="Eliminar ${escapeHtml(item.name)}">⌫</button></div>` : ""}</article>`;
  };
  const firstUse = !state.items.length && state.filter === "available" && state.categoryFilter === "all";
  $("#itemList").innerHTML = shown.length
    ? categories.map(([id, label]) => {
      const inCategory = shown.filter((item) => (item.category || "otros") === id);
      return inCategory.length ? `<section class="category-group"><h3>${label} <span>${inCategory.length}</span></h3>${inCategory.map(itemRow).join("")}</section>` : "";
    }).join("")
    : `<div class="empty-state"><span class="empty-icon">${firstUse ? "🧺" : "✳"}</span><strong>${firstUse ? canEdit ? "Tu despensa empieza aquí" : state.user ? "Despensa compartida" : "Crea una cuenta para empezar" : "No hay alimentos en esta sección"}</strong><p>${firstUse ? canEdit ? "Añade un alimento y su fecha para empezar a aprovecharlo." : state.user ? "Abre tu despensa desde Mi cuenta para añadir alimentos." : "Regístrate para añadir alimentos y sincronizarlos entre dispositivos." : "Prueba con otra sección o filtro."}</p>${firstUse ? canEdit ? '<button class="primary-button" id="addEmptyBtn">Añadir alimento</button><button class="sample-button" id="sampleBtn">Probar con datos de ejemplo</button>' : state.user ? "" : '<button class="primary-button" id="registerEmptyBtn">Crear cuenta</button>' : ""}</div>`;
}

function renderShopping() {
  const canEdit = Boolean(state.user && !state.token);
  const pending = state.shoppingItems.filter((item) => !item.checked);
  const bought = state.shoppingItems.filter((item) => item.checked);
  $("#shoppingCount").textContent = pending.length;
  const row = (item) => `<article class="shopping-row ${item.checked ? "checked" : ""}"><input type="checkbox" data-action="toggle" data-id="${item.id}" ${item.checked ? "checked" : ""} ${canEdit ? "" : "disabled"} aria-label="${item.checked ? "Volver a pendiente" : "Marcar como comprado"}: ${escapeHtml(item.name)}"><span class="item-glyph" aria-hidden="true">${emojiFor(item.name)}</span><span class="shopping-details"><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.quantity)} ${escapeHtml(item.unit)}</small></span>${canEdit ? `<span class="shopping-row-actions"><button type="button" data-action="stock" data-id="${item.id}">Al frigo</button><button type="button" data-action="remove" data-id="${item.id}" aria-label="Quitar ${escapeHtml(item.name)} de la lista">Quitar</button></span>` : ""}</article>`;
  const groups = categories.map(([id, label]) => {
    const inCategory = pending.filter((item) => item.category === id);
    return inCategory.length ? `<section class="category-group"><h3>${label} <span>${inCategory.length}</span></h3>${inCategory.map(row).join("")}</section>` : "";
  }).join("");
  $("#shoppingList").innerHTML = (pending.length ? groups : bought.length ? '<div class="shopping-empty"><strong>No quedan compras pendientes</strong></div>' : state.user ? '<div class="shopping-empty"><strong>Tu lista está al día</strong><span>Los alimentos que marques como agotados aparecerán aquí.</span></div>' : '<div class="shopping-empty"><strong>Tu lista de la compra te espera</strong><span>Crea una cuenta para añadir productos.</span></div>') +
    (bought.length ? `<section class="shopping-done"><h3>Comprados · ${bought.length}</h3>${bought.map(row).join("")}</section>` : "");
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
  if (!state.user && !state.token) return clearPantry();
  const [pantry, shopping] = await Promise.all([api("/api/items"), api("/api/shopping")]);
  state.items = pantry.items;
  state.shoppingItems = shopping.items;
  renderItems();
  renderShopping();
  renderRecipes();
}

function clearPantry() {
  state.items = [];
  state.shoppingItems = [];
  renderItems();
  renderShopping();
  renderRecipes();
}

let autoEstimated = false;

function produceSuggestion() {
  if ($("#itemCategory").value !== "frutas_verduras") return null;
  const name = normalize($("#itemName").value);
  if (!name) return null;
  if (/\b(tomate|patata|cebolla|platano)\b/.test(name) && !/\b(cortado|troceado|pelado|picado)\b/.test(name))
    return { note: "Este producto entero suele conservarse mejor fuera del frigo. Introduce una fecha manual si quieres seguirlo." };
  if (/\b(cortado|troceado|pelado|picado)\b/.test(name)) return { days: /\btomate\b/.test(name) ? 2 : 3, note: "Producto cortado: guárdalo tapado y refrigerado." };
  const found = produceLife.find((entry) => entry.names.test(name));
  const note = /\b(pera|melocoton|nectarina|manzana)\b/.test(name)
    ? "Cuando esté maduro, guárdalo entero en el cajón del frigo."
    : /\b(fresa|frambuesa|mora|arandano)\b/.test(name)
      ? "Guarda las bayas enteras y sin lavar; retira las piezas dañadas."
      : "Estimación de frescura para el producto entero en el cajón del frigo.";
  return found ? { days: found.days, note } : { note: "Aún no hay una estimación para este producto. Introduce la fecha manualmente." };
}

function applyProduceEstimate() {
  const suggestion = produceSuggestion();
  const start = $("#produceStartDate").value;
  if (!suggestion?.days || !/^\d{4}-\d{2}-\d{2}$/.test(start)) return;
  $("#itemDate").value = addDays(start, suggestion.days);
  $("#itemDateKind").value = "estimacion";
  autoEstimated = true;
}

function updateProduceEstimate() {
  const suggestion = produceSuggestion();
  $("#produceEstimate").hidden = !suggestion;
  if (!suggestion) {
    if (autoEstimated) { $("#itemDate").value = ""; $("#itemDateKind").value = "caducidad"; autoEstimated = false; }
    return;
  }
  const days = suggestion.days;
  $("#produceStartLabel").hidden = !days;
  $("#produceEstimateText").textContent = days ? "Uso orientativo: " + days + (days === 1 ? " día" : " días") + " desde que lo guardaste. " + suggestion.note : suggestion.note;
  $("#applyEstimateBtn").hidden = !days;
  if (days && (autoEstimated || (!state.editId && !$("#itemDate").value))) applyProduceEstimate();
  else if (!days && autoEstimated) { $("#itemDate").value = ""; $("#itemDateKind").value = "caducidad"; autoEstimated = false; }
}

function openDialog() {
  if (!requireAccount()) return;
  state.editId = null;
  state.shoppingId = null;
  autoEstimated = false;
  $("#addForm").reset();
  $("#produceStartDate").value = todayIso();
  updateProduceEstimate();
  $("#itemDialogEyebrow").textContent = "NUEVO ALIMENTO";
  $("#itemDialogTitle").textContent = "Añadir a la despensa";
  $("#saveItemBtn").textContent = "Guardar alimento";
  $("#addDialog").showModal();
  $("#itemName").focus();
}
function openEdit(id) {
  if (!requireAccount()) return;
  const item = state.items.find((entry) => entry.id === id);
  if (!item) return toast("No se encontró el alimento");
  state.editId = id;
  state.shoppingId = null;
  autoEstimated = false;
  $("#itemName").value = item.name;
  $("#itemQuantity").value = item.quantity;
  $("#itemUnit").value = item.unit;
  $("#itemCategory").value = item.category || "otros";
  $("#itemDate").value = item.expiry_date;
  $("#itemDateKind").value = item.date_kind;
  $("#produceStartDate").value = item.stored_on || item.created_at?.slice(0, 10) || todayIso();
  updateProduceEstimate();
  $("#itemDialogEyebrow").textContent = "ACTUALIZAR ALIMENTO";
  $("#itemDialogTitle").textContent = "Editar alimento";
  $("#saveItemBtn").textContent = "Guardar cambios";
  $("#addDialog").showModal();
  $("#itemName").focus();
}
function closeDialog() { $("#addDialog").close(); state.editId = null; state.shoppingId = null; }

function stockShoppingItem(id) {
  if (!requireAccount()) return;
  const item = state.shoppingItems.find((entry) => entry.id === id);
  if (!item) return toast("No se encontró el producto");
  openDialog();
  state.shoppingId = id;
  $("#itemName").value = item.name;
  $("#itemQuantity").value = item.quantity;
  $("#itemUnit").value = item.unit;
  $("#itemCategory").value = item.category;
  $("#itemDate").value = "";
  updateProduceEstimate();
  $("#itemDialogEyebrow").textContent = "DE LA COMPRA AL FRIGO";
  $("#itemDialogTitle").textContent = "Reponer alimento";
  $("#saveItemBtn").textContent = "Guardar en el frigo";
}

async function saveItem(event) {
  event.preventDefault();
  if (!requireAccount()) return;
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  body.quantity = Number(body.quantity);
  body.stored_on = body.date_kind === "estimacion" ? $("#produceStartDate").value : null;
  const saveButton = form.querySelector('button[type="submit"]');
  saveButton.disabled = true;
  try {
    const editing = Boolean(state.editId);
    const shoppingId = state.shoppingId;
    await api(shoppingId ? `/api/shopping/${shoppingId}/replenish` : editing ? `/api/items/${state.editId}` : "/api/items", { method: editing ? "PUT" : "POST", body: JSON.stringify(body) });
    form.reset(); closeDialog(); await refresh();
    toast(editing ? "Alimento actualizado" : shoppingId ? "Producto repuesto en el frigo" : "Alimento añadido a tu despensa");
  } catch (error) { toast(error.message); }
  finally { saveButton.disabled = false; }
}

async function itemAction(button) {
  if (!requireAccount()) return;
  const { action, id } = button.dataset;
  if (action === "edit") return openEdit(id);
  if (action === "delete" && !confirm("¿Eliminar este alimento de la despensa?")) return;
  button.disabled = true;
  try {
    if (action === "delete") await api(`/api/items/${id}`, { method: "DELETE" });
    else await api(`/api/items/${id}`, { method: "PATCH", body: JSON.stringify({ status: { consume: "consumed", discard: "discarded", restore: "available" }[action] }) });
    await refresh(); toast(action === "consume" ? "Producto agotado y añadido a la lista de la compra" : "Despensa actualizada");
  } catch (error) { button.disabled = false; toast(error.message); }
}

async function saveShoppingItem(event) {
  event.preventDefault();
  if (!requireAccount()) return;
  const form = event.currentTarget;
  const body = Object.fromEntries(new FormData(form).entries());
  body.quantity = Number(body.quantity);
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  try {
    await api("/api/shopping", { method: "POST", body: JSON.stringify(body) });
    form.reset(); $("#shoppingDialog").close(); await refresh(); toast("Producto apuntado en la lista");
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; }
}

async function shoppingAction(action, id, checked) {
  if (!requireAccount()) return;
  if (action === "stock") return stockShoppingItem(id);
  try {
    if (action === "toggle") await api(`/api/shopping/${id}`, { method: "PATCH", body: JSON.stringify({ checked }) });
    else if (action === "remove") await api(`/api/shopping/${id}`, { method: "DELETE" });
    await refresh();
    toast(action === "toggle" ? checked ? "Marcado como comprado" : "Producto pendiente de compra" : "Producto quitado de la lista");
  } catch (error) { toast(error.message); await refresh().catch(() => {}); }
}

async function loadSample() {
  if (!requireAccount()) return;
  const samples = [
    { name: "Tomate", quantity: 3, unit: "ud", category: "frutas_verduras", expiry_date: dateAfter(1), date_kind: "caducidad" },
    { name: "Queso fresco", quantity: 1, unit: "ud", category: "lacteos_huevos", expiry_date: dateAfter(2), date_kind: "caducidad" },
    { name: "Pan", quantity: 1, unit: "ud", category: "panaderia", expiry_date: dateAfter(2), date_kind: "consumo_preferente" },
    { name: "Huevos", quantity: 4, unit: "ud", category: "lacteos_huevos", expiry_date: dateAfter(4), date_kind: "consumo_preferente" },
    { name: "Calabacín", quantity: 2, unit: "ud", category: "frutas_verduras", expiry_date: dateAfter(1), date_kind: "caducidad" }
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
  if (!requireAccount()) return;
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
  $("#itemList").addEventListener("click", (event) => { if (event.target.id === "registerEmptyBtn") openAuth("register"); else if (event.target.id === "addEmptyBtn") openDialog(); else if (event.target.id === "sampleBtn") loadSample(); else if (event.target.dataset.action) itemAction(event.target); });
  $("#closeDialog").addEventListener("click", closeDialog);
  $("#cancelDialog").addEventListener("click", closeDialog);
  $("#addForm").addEventListener("submit", saveItem);
  $("#itemName").addEventListener("input", () => {
    const name = normalize($("#itemName").value);
    if ($("#itemCategory").value === "otros" && (produceLife.some((entry) => entry.names.test(name)) || /\b(tomate|patata|cebolla|platano)\b/.test(name)))
      $("#itemCategory").value = "frutas_verduras";
    updateProduceEstimate();
  });
  $("#itemCategory").addEventListener("change", updateProduceEstimate);
  $("#produceStartDate").addEventListener("change", updateProduceEstimate);
  $("#applyEstimateBtn").addEventListener("click", applyProduceEstimate);
  $("#itemDate").addEventListener("input", () => { autoEstimated = false; });
  $("#itemDateKind").addEventListener("change", () => { autoEstimated = false; });
  $("#addShoppingBtn").addEventListener("click", () => { if (!requireAccount()) return; $("#shoppingForm").reset(); $("#shoppingDialog").showModal(); $("#shoppingForm input[name=name]").focus(); });
  $("#closeShopping").addEventListener("click", () => $("#shoppingDialog").close());
  $("#cancelShopping").addEventListener("click", () => $("#shoppingDialog").close());
  $("#shoppingDialog").addEventListener("click", (event) => { if (event.target === $("#shoppingDialog")) $("#shoppingDialog").close(); });
  $("#shoppingForm").addEventListener("submit", saveShoppingItem);
  $("#shoppingList").addEventListener("change", (event) => { if (event.target.dataset.action === "toggle") shoppingAction("toggle", event.target.dataset.id, event.target.checked); });
  $("#shoppingList").addEventListener("click", (event) => { const button = event.target.closest("button[data-action]"); if (button) shoppingAction(button.dataset.action, button.dataset.id); });
  $("#notifyBtn").addEventListener("click", activateNotifications);
  $("#testNotifyBtn").addEventListener("click", async () => { if (!requireAccount()) return; try { await api("/api/push/test", { method: "POST" }); toast("Aviso de prueba enviado"); } catch (error) { toast(error.message); } });
  $("#shareBtn").addEventListener("click", async () => {
    if (!state.user && !state.token) return requireAccount();
    try {
      const token = state.token || (await api("/api/share", { method: "POST" })).token;
      await navigator.clipboard.writeText(`${location.origin}/#h=${token}`);
      toast("Enlace copiado. Cualquiera con él puede acceder a esta despensa.");
    } catch (error) { toast(`No se pudo copiar el enlace: ${error.message}`); }
  });
  $("#accountBtn").addEventListener("click", () => openAuth(state.user ? "register" : "login"));
  $("#registerLink").addEventListener("click", () => openAuth("register"));
  $("#closeAuth").addEventListener("click", () => $("#authDialog").close());
  $("#authDialog").addEventListener("click", (event) => { if (event.target === $("#authDialog")) $("#authDialog").close(); });
  $("#authForm").addEventListener("submit", submitAuth);
  $("#authSwitch").addEventListener("click", () => setAuthMode(state.authMode === "register" ? "login" : "register"));
  $("#logoutBtn").addEventListener("click", logout);
  $("#ownPantryBtn").addEventListener("click", async () => {
    state.token = "";
    if (location.hash.startsWith("#h=")) history.replaceState(null, "", location.pathname + location.search);
    $("#authDialog").close();
    renderAuth();
    try { await refresh(); } catch (error) { toast(error.message); }
  });
  document.querySelectorAll(".filter").forEach((button) => button.addEventListener("click", () => { state.filter = button.dataset.filter; document.querySelectorAll(".filter").forEach((node) => node.classList.toggle("active", node === button)); renderItems(); }));
  $("#categoryFilter").addEventListener("change", (event) => { state.categoryFilter = event.target.value; renderItems(); });
  $("#addDialog").addEventListener("click", (event) => { if (event.target === $("#addDialog")) closeDialog(); });
}

async function init() {
  bindEvents();
  $("#todayLabel").textContent = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Madrid" }).format(new Date());
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  try {
    const { user } = await api("/api/auth/me");
    state.user = user;
    const incoming = location.hash.match(/^#h=([a-f0-9]{64})$/)?.[1];
    if (user && !incoming) { state.token = ""; localStorage.removeItem("primero-esto-household"); }
    else await ensureHousehold();
    renderAuth();
    await refresh();
  }
  catch (error) { $("#itemList").innerHTML = `<div class="empty-state"><strong>No se pudo cargar la despensa</strong><p>${escapeHtml(error.message)}</p></div>`; toast(error.message); }
  setInterval(() => { if (!document.hidden && (state.user || state.token)) refresh().catch(() => {}); }, 30000);
}

init();

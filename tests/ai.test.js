import test from "node:test";
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { aiRoute } from "../src/ai.js";

function database(items = []) {
  const settings = new Map();
  return {
    settings,
    prepare(sql) {
      return {
        bind(...args) { this.args = args; return this; },
        async first() { return settings.get(this.args[0]) || null; },
        async run() {
          if (sql.startsWith("DELETE")) settings.delete(this.args[0]);
          else if (sql.startsWith("INSERT")) settings.set(this.args[0], { provider: this.args[1], model: this.args[2], encrypted_key: this.args[3] });
        },
        async all() { return { results: items }; }
      };
    }
  };
}

const route = (method, path, body, env, user) => aiRoute(new Request(`https://example.test${path}`, { method, ...(body ? { body: JSON.stringify(body), headers: { "content-type": "application/json" } } : {}) }), env, new URL(`https://example.test${path}`), user);

test("AI connection is private to the signed-in user and stores only ciphertext", async () => {
  const DB = database([{ name: "tomate", quantity: 2, unit: "ud", expiry_date: "2099-01-01", date_kind: "caducidad" }]);
  const env = { DB, AI_SETTINGS_KEY: randomBytes(32).toString("hex") };
  const owner = { id: "user-1", household_id: "home-1" };
  const stranger = { id: "user-2", household_id: "home-2" };
  const apiKey = "private-test-api-key";
  assert.equal((await route("GET", "/api/ai/settings", null, env, null)).status, 401);
  assert.equal((await route("PUT", "/api/ai/settings", { provider: "custom", model: "example", api_key: apiKey }, env, owner)).status, 400);
  const saved = await route("PUT", "/api/ai/settings", { provider: "openai", model: "test-model", api_key: apiKey }, env, owner);
  assert.equal(saved.status, 200);
  assert.equal((await saved.text()).includes(apiKey), false);
  assert.equal(DB.settings.get(owner.id).encrypted_key.includes(apiKey), false);
  assert.deepEqual(await (await route("GET", "/api/ai/settings", null, env, owner)).json(), { configured: true, provider: "openai", model: "test-model" });
  assert.deepEqual(await (await route("GET", "/api/ai/settings", null, env, stranger)).json(), { configured: false, provider: null, model: null });

  const previousFetch = globalThis.fetch;
  let called = false;
  globalThis.fetch = async (url, options) => {
    called = true;
    assert.equal(url, "https://api.openai.com/v1/chat/completions");
    assert.equal(options.headers.authorization, `Bearer ${apiKey}`);
    const prompt = JSON.parse(options.body).messages[1].content;
    assert.match(prompt, /tomate/);
    return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ recipes: [{ name: "Ensalada", description: "Corta el tomate.", ingredients: ["tomate"], steps: ["Lava y corta el tomate."], minutes: 5 }] }) } }] }), { status: 200 });
  };
  try {
    const generated = await route("POST", "/api/ai/recipes", null, env, owner);
    assert.equal(generated.status, 200);
    assert.equal((await generated.json()).recipes[0].name, "Ensalada");
    assert.equal(called, true);
    assert.equal((await route("POST", "/api/ai/recipes", null, env, stranger)).status, 409);
  } finally { globalThis.fetch = previousFetch; }

  assert.equal((await route("DELETE", "/api/ai/settings", null, env, owner)).status, 200);
  assert.equal(DB.settings.has(owner.id), false);
});

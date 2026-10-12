/**
 * Live contract tests for Zad Al-Kashaf server functions and Better Auth.
 *
 * Public catalog APIs run through route loaders (`getMeta`, `listProducts`,
 * `getProduct`, `listTroops`, `getTroop`). Session APIs are `/api/auth/*`.
 * Auth-gated loaders (`getCurrentUser` / `adminOverview`) must redirect.
 *
 * Skips the suite when the app is not listening so `npm test` stays green
 * without a running server. Point at a live instance with `API_BASE`.
 */
import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

const BASE = (process.env.API_BASE ?? "http://127.0.0.1:8080").replace(/\/$/, "");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let serverUp = false;
try {
  serverUp = (await fetch(`${BASE}/ar`, { signal: AbortSignal.timeout(4000) })).ok;
} catch {
  serverUp = false;
}

/** @type {string[]} */
let productIds = [];
/** @type {string[]} */
let troopIds = [];
/** @type {string[]} */
let categoryIds = [];

async function request(path, init = {}) {
  const res = await fetch(`${BASE}${path}`, {
    redirect: "manual",
    ...init,
    headers: {
      accept: init.headers?.accept ?? "*/*",
      origin: BASE,
      ...init.headers,
    },
  });
  const text = await res.text();
  return { res, text, status: res.status, location: res.headers.get("location") };
}

function idsFrom(html, pattern) {
  const global = pattern.global ? pattern : new RegExp(pattern.source, `${pattern.flags}g`);
  return [...new Set([...html.matchAll(global)].map((m) => m[1]))];
}

before(async () => {
  if (!serverUp) return;

  const products = await request("/ar/products");
  const troops = await request("/ar/troops");
  productIds = idsFrom(products.text, /href="\/ar\/products\/([0-9a-f-]{36})"/gi);
  troopIds = idsFrom(troops.text, /href="\/ar\/troops\/([0-9a-f-]{36})"/gi);
  categoryIds = idsFrom(products.text, /name="categoryId"[^]*?<option value="([0-9a-f-]{36})"/i).length
    ? idsFrom(products.text, /<option value="([0-9a-f-]{36})"/gi)
    : idsFrom(products.text, /categoryId=([0-9a-f-]{36})/gi);
});

describe("zad APIs", { skip: !serverUp }, () => {
  test("getMeta + listProducts serve the Arabic catalog", async () => {
    const { status, text } = await request("/ar/products");
    assert.equal(status, 200);
    assert.match(text, /<option value="[0-9a-f-]{36}"/i);
    assert.ok(productIds.length > 0, "expected seeded listings from listProducts");
    assert.ok(productIds.every((id) => UUID.test(id)));
  });

  test("listProducts honors locale and catalog filters", async () => {
    const fr = await request("/fr/products");
    assert.equal(fr.status, 200);
    assert.match(fr.text, /Produits|produits|Annonces/i);

    const unknown = await request("/ar/products?q=zzzxnotarealproduct999");
    assert.equal(unknown.status, 200);
    for (const id of productIds) {
      assert.doesNotMatch(unknown.text, new RegExp(`/ar/products/${id}`));
    }

    if (categoryIds[0]) {
      const filtered = await request(`/ar/products?categoryId=${categoryIds[0]}&operation=sale`);
      assert.equal(filtered.status, 200);
    }
  });

  test("getProduct returns a listing and 404s unknown ids", async () => {
    assert.ok(productIds[0], "need a listing id from listProducts");
    const found = await request(`/ar/products/${productIds[0]}`);
    assert.equal(found.status, 200);
    assert.match(found.text, /product\.contact|تواصل|Contacter|واتساب|هاتف|€|دج|DA/i);

    const missing = await request("/ar/products/00000000-0000-4000-8000-000000000000");
    assert.equal(missing.status, 200);
    assert.match(missing.text, /غير موجود|introuvable|gone|unavailable/i);

    const invalid = await request("/ar/products/not-a-uuid");
    assert.ok([200, 400, 404, 500].includes(invalid.status));
  });

  test("listTroops and getTroop return active troops", async () => {
    const list = await request("/ar/troops");
    assert.equal(list.status, 200);
    assert.ok(troopIds.length > 0, "expected seeded troops from listTroops");

    const detail = await request(`/ar/troops/${troopIds[0]}`);
    assert.equal(detail.status, 200);
    assert.match(detail.text, /فوج|troupe|troop/i);

    const missing = await request("/ar/troops/00000000-0000-4000-8000-000000000000");
    assert.equal(missing.status, 200);
    assert.match(missing.text, /غير|gone|introuvable|back/i);
  });

  test("homepage loaders compose getMeta, listProducts and listTroops", async () => {
    const { status, text } = await request("/ar");
    assert.equal(status, 200);
    assert.match(text, /زاد الكشاف/);
    assert.ok(
      productIds.some((id) => text.includes(`/ar/products/${id}`)) ||
        troopIds.some((id) => text.includes(`/ar/troops/${id}`)),
      "home should surface catalog cards",
    );
  });

  test("Better Auth session API is empty when signed out", async () => {
    const { status, text, res } = await request("/api/auth/get-session");
    assert.equal(status, 200);
    assert.equal(res.headers.get("content-type")?.includes("json") || text === "null" || text === "", true);
    assert.equal(JSON.parse(text || "null"), null);
  });

  test("email sign-in rejects invalid credentials without leaking a session", async () => {
    const { status, text, res } = await request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({ email: "nobody@example.com", password: "wrong-password-123" }),
    });
    assert.ok(status >= 400, `expected auth failure, got ${status} ${text.slice(0, 200)}`);
    const setCookie = res.headers.get("set-cookie") ?? "";
    assert.doesNotMatch(setCookie, /session_token=([^;]+)/);
  });

  test("email sign-up rejects a short password", async () => {
    const { status } = await request("/api/auth/sign-up/email", {
      method: "POST",
      headers: { "content-type": "application/json", origin: BASE },
      body: JSON.stringify({
        email: "too-short@example.com",
        password: "123",
        name: "Test User",
      }),
    });
    assert.ok(status >= 400, `expected validation failure, got ${status}`);
  });

  test("auth-gated getCurrentUser redirects anonymous visitors", async () => {
    const account = await request("/ar/account");
    assert.ok([302, 303, 307, 308].includes(account.status), `account status ${account.status}`);
    assert.match(account.location ?? "", /\/ar\/login/);

    const admin = await request("/ar/admin");
    assert.ok([302, 303, 307, 308].includes(admin.status), `admin status ${admin.status}`);
    assert.match(admin.location ?? "", /\/ar\/(login)?$/);
  });
});

after(() => {
  if (!serverUp) {
    console.log(`zad API tests skipped: nothing listening at ${BASE}`);
  }
});

import assert from "node:assert/strict";
import test from "node:test";

const base = process.env.I18N_TEST_BASE_URL ?? "http://127.0.0.1:3166";

test("production keeps business routes and pending payment returns alongside the new homepage", async () => {
  const health = await fetch(`${base}/health`);
  assert.equal(health.status, 200);
  assert.equal((await health.json()).ok, true);
  assert.equal((await fetch(`${base}/api/config`)).status, 200);
  assert.equal((await fetch(`${base}/api/admin/orders`)).status, 401);
  assert.equal((await fetch(`${base}/status.html`)).status, 200);
  for (const route of [
    "/order.html",
    "/?payment=return&orderId=local-fixture",
    "/?payment=cancel",
    "/?token=local-fixture",
  ]) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200, route);
    assert.ok((await response.text()).includes('src="/checkout.js"'), route);
    assert.match(response.headers.get("cache-control") ?? "", /no-store/);
  }
  const marketing = await fetch(`${base}/ar`);
  const html = await marketing.text();
  assert.equal(marketing.status, 200);
  assert.ok(html.includes("film-frames"));
  assert.ok(html.includes('href="/status.html"'));
  assert.ok(!html.includes("noindex"));
  assert.ok(!html.includes("معاينة تصميم محلية"));
  for (const locale of ["ar", "en", "fr", "es"]) {
    const page = await fetch(`${base}/${locale}`);
    const content = await page.text();
    for (const plan of ["short", "signature"]) {
      assert.ok(content.includes(`href="/order.html?package=${plan}#order"`), `${locale}:${plan}`);
    }
    for (const route of ["/order.html#order", "/terms.html", "/privacy.html", "/refunds.html"]) {
      assert.ok(content.includes(`href="${route}"`), `${locale}:${route}`);
    }
    const orderPage = await fetch(`${base}/order.html?package=signature`);
    assert.equal(orderPage.status, 200);
    assert.ok((await orderPage.text()).includes('src="/checkout.js"'));
  }
  const font = await fetch(`${base}/fonts/harmattan/Harmattan-Regular.ttf`);
  assert.equal(font.status, 200);
  assert.ok((await font.arrayBuffer()).byteLength > 1000);
});

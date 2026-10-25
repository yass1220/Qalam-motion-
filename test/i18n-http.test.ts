import assert from "node:assert/strict";
import test from "node:test";
import {routing} from "../i18n/routing";
import {messages} from "../i18n/messages";
import {pageCopy, pageHref, publicPages, packages, studioEmail} from "../content/public-site";
import {readFile} from "node:fs/promises";

const base = process.env.I18N_TEST_BASE_URL ?? "http://127.0.0.1:3155";

test("all 28 public pages return localized main content and links without JS", async () => {
  assert.ok(base);
  for (const locale of routing.locales) {
    for (const page of publicPages) {
    const path = pageHref(locale, page);
    const response: Response = await fetch(`${base}${path}`, {
      headers: {"accept-language": locale === "ar" ? "fr" : "ar", cookie: "NEXT_LOCALE=es"},
      redirect: "manual",
    });
    assert.equal(response.status, 200, path);
    // Remove hydration payloads: translations must occur in the visible HTML itself.
    const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    const visibleText = html.replace(/<[^>]*>/g, "");
    const copy = pageCopy(locale, page);
    assert.ok(html.includes(`<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"`));
    assert.ok(html.includes(`<h1>${copy.title}</h1>`), path);
    assert.ok(html.includes(`<p class="lead">${copy.description}</p>`), path);
    assert.ok(html.includes(`<title>${copy.title} | Qalam Motion</title>`), path);
    assert.ok(html.includes(`name="description" content="${copy.description}"`), path);
    assert.ok(html.includes("noindex"));
    assert.ok(html.includes('href="#main"'));
    for (const target of routing.locales) assert.ok(html.includes(`href="${pageHref(target, page)}"`), path);
    for (const destination of publicPages) assert.ok(html.includes(`href="${pageHref(locale, destination)}"`), path);
    if (page === "pricing") {
      const currency = new Intl.NumberFormat(locale, {style: "currency", currency: "USD", currencyDisplay: "code", maximumFractionDigits: 0});
      for (const plan of packages) {
        assert.ok(html.includes(currency.format(plan.price)), path);
        assert.ok(html.includes(plan.duration), path);
      }
      for (const feature of Object.values(messages[locale].Pricing.features)) assert.ok(visibleText.includes(feature), path);
      assert.ok(html.includes('<bdi dir="ltr">40–45</bdi>'));
      assert.ok(html.includes('<bdi dir="ltr">1080 × 1920</bdi>'));
    }
    if (page === "faq") {
      assert.equal((html.match(/<details>/g) ?? []).length, 6, path);
      for (const item of Object.values(messages[locale].Faq)) assert.ok(visibleText.includes(item.answer), path);
    }
    if (page === "contact") {
      assert.ok(html.includes(`href="mailto:${studioEmail}"`));
      assert.ok(html.includes(messages[locale].Contact.mailHint));
      assert.ok(!html.includes("<form"), "No pretend submission before the enquiry integration");
    }
    }
  }
});

test("production build prerenders every approved locale/page combination", async () => {
  const manifest = JSON.parse(await readFile(new URL("../.next/prerender-manifest.json", import.meta.url), "utf8")) as {routes: Record<string, {initialRevalidateSeconds: number | false}>};
  for (const locale of routing.locales) for (const page of publicPages) {
    const path = pageHref(locale, page);
    assert.ok(Object.hasOwn(manifest.routes, path), `Missing prerender: ${path}`);
    assert.equal(manifest.routes[path].initialRevalidateSeconds, false, path);
  }
});

test("production root detects Arabic and cached preference without redirect loops", async () => {
  assert.ok(base);
  const visits: Array<[Record<string, string>, string]> = [
    [{"accept-language": "ar-MA,fr;q=0.8"}, "ar"],
    [{"accept-language": "ar", cookie: "NEXT_LOCALE=fr"}, "fr"],
    [{"accept-language": "ja"}, "en"],
  ];
  for (const [headers, expected] of visits) {
    const response: Response = await fetch(`${base}/?tag=a&tag=b`, {headers, redirect: "manual"});
    assert.ok([307, 308].includes(response.status));
    const location: string | null = response.headers.get("location");
    assert.ok(location);
    const url: URL = new URL(location, base);
    assert.equal(url.pathname, `/${expected}`);
    assert.equal(url.search, "?tag=a&tag=b");
    const final = await fetch(url, {headers: {"accept-language": "es"}, redirect: "manual"});
    assert.equal(final.status, 200);
  }
});

test("unknown localized pages return translated 404; invalid prefixes terminate", async () => {
  assert.ok(base);
  for (const locale of routing.locales) {
    for (const suffix of ["does-not-exist", "services/does-not-exist", "portfolio", "terms", "privacy", "refunds"]) {
    const response: Response = await fetch(`${base}/${locale}/${suffix}`);
    assert.equal(response.status, 404);
    assert.ok((await response.text()).includes(messages[locale].NotFound.title));
    }
  }
  const invalid = await fetch(`${base}/de`, {headers: {"accept-language": "en"}});
  assert.equal(invalid.status, 404);
});

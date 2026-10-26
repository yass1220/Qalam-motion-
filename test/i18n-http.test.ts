import assert from "node:assert/strict";
import test from "node:test";
import {routing} from "../i18n/routing";
import {messages} from "../i18n/messages";

const base = process.env.I18N_TEST_BASE_URL ?? "http://127.0.0.1:3155";

test("production locale matrix returns translated HTML, direction and metadata without JS", async () => {
  assert.ok(base);
  for (const locale of routing.locales) {
    const response: Response = await fetch(`${base}/${locale}`, {
      headers: {"accept-language": locale === "ar" ? "fr" : "ar", cookie: "NEXT_LOCALE=es"},
      redirect: "manual",
    });
    assert.equal(response.status, 200, locale);
    const html = await response.text();
    assert.ok(html.includes(`<html lang="${locale}" dir="${locale === "ar" ? "rtl" : "ltr"}"`));
    assert.ok(html.includes(messages[locale].Home.title));
    assert.ok(html.includes(messages[locale].Metadata.description));
    assert.equal(html.includes("noindex"), process.env.EXPECT_INDEXABLE !== "true");
    for (const target of routing.locales) assert.ok(html.includes(`href="/${target}"`));
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
    const response: Response = await fetch(`${base}/${locale}/does-not-exist`);
    assert.equal(response.status, 404);
    assert.ok((await response.text()).includes(messages[locale].NotFound.title));
  }
  const invalid = await fetch(`${base}/de`, {headers: {"accept-language": "en"}});
  assert.equal(invalid.status, 404);
});

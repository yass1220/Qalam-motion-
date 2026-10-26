import assert from "node:assert/strict";
import test from "node:test";
import {NextRequest} from "next/server";
import proxy from "../proxy";
import {routing} from "../i18n/routing";
import {messages} from "../i18n/messages";
import {localizedHref} from "../i18n/paths";

function messageKeys(value: unknown, prefix = ""): string[] {
  if (typeof value === "string") {
    assert.ok(value.trim().length > 0, `Empty translation at ${prefix}`);
    return [prefix];
  }
  assert.ok(value && typeof value === "object" && !Array.isArray(value));
  return Object.entries(value).flatMap(([key, child]) => messageKeys(child, `${prefix}.${key}`)).sort();
}

test("published catalogs have complete, nonempty matching keys", () => {
  for (const locale of routing.locales) {
    assert.deepEqual(messageKeys(messages[locale]), messageKeys(messages.en));
  }
  assert.throws(() => messageKeys({title: " "}));
});

test("first visits negotiate regional browser languages and fall back to English", () => {
  for (const [accept, expected] of [["ar-MA,fr;q=0.8", "ar"], ["fr-CA", "fr"], ["es-MX", "es"], ["en-GB", "en"], ["ja", "en"], ["ar;q=0,fr;q=0.8", "fr"], ["*", "en"], ["", "en"]]) {
    const response = proxy(new NextRequest("http://localhost:3155/", {headers: {"accept-language": accept}}));
    const location = response.headers.get("location");
    assert.ok(location);
    assert.equal(new URL(location).pathname, `/${expected}`);
  }
});

test("saved preference takes precedence over browser language", () => {
  const response = proxy(new NextRequest("http://localhost:3155/", {
    headers: {cookie: "NEXT_LOCALE=fr", "accept-language": "ar"},
  }));
  assert.equal(response.headers.get("location"), "http://localhost:3155/fr");
});

test("explicit locale wins over preference and browser; selection persists", () => {
  for (const locale of routing.locales) {
    const response = proxy(new NextRequest(`http://localhost:3155/${locale}`, {
      headers: {cookie: "NEXT_LOCALE=fr", "accept-language": "ar"},
    }));
    assert.equal(response.headers.get("location"), null);
    if (locale !== "fr") assert.match(response.headers.get("set-cookie") ?? "", new RegExp(`NEXT_LOCALE=${locale}`));
  }
});

test("language links retain equivalent paths, duplicate queries and fragments", () => {
  for (const locale of routing.locales) {
    assert.equal(localizedHref("/fr/services", locale, "?tag=a&tag=b", "#details"), `/${locale}/services?tag=a&tag=b#details`);
    assert.equal(localizedHref("/ar", locale), `/${locale}`);
    assert.equal(localizedHref("/archive", locale), `/${locale}/archive`);
  }
});

test("negotiation preserves query parameters and does not loop", () => {
  const response = proxy(new NextRequest("http://localhost:3155/?tag=a&tag=b", {headers: {"accept-language": "es"}}));
  const location = response.headers.get("location");
  assert.ok(location);
  assert.equal(new URL(location).search, "?tag=a&tag=b");
  const second = proxy(new NextRequest(location, {headers: {"accept-language": "ar"}}));
  assert.equal(second.headers.get("location"), null);
});

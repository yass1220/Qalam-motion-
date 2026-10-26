import {messages} from "@/i18n/messages";
import type {Locale} from "@/i18n/routing";

export const publicPages = ["home", "services", "process", "pricing", "faq", "studio", "contact"] as const;
export type PublicPage = (typeof publicPages)[number];
export const publicSlugs = publicPages.filter((page) => page !== "home");
export function isPublicSlug(value: string): value is Exclude<PublicPage, "home"> {
  return publicSlugs.some((slug) => slug === value);
}
export function pageHref(locale: Locale, page: PublicPage) {
  return `/${locale}${page === "home" ? "" : `/${page}`}`;
}
// Keep the legacy package contract independent of translated copy.
export const packages = [
  {id: "short", price: 15, duration: "40–45"},
  {id: "signature", price: 25, duration: "60–75"},
] as const;
export const studioEmail = "yassah1220@gmail.com";
export function pageCopy(locale: Locale, page: PublicPage) {
  const catalog = messages[locale];
  return page === "home" ? catalog.Home : catalog.Pages[page];
}

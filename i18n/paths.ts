import {hasLocale} from "next-intl";
import {routing, type Locale} from "./routing";

export function localizedHref(pathname: string, locale: Locale, search = "", hash = "") {
  const segments = pathname.split("/");
  const first = segments[1];
  const route = first && hasLocale(routing.locales, first)
    ? "/" + segments.slice(2).join("/")
    : pathname;
  const suffix = route === "/" ? "" : route;
  return `/${locale}${suffix}${search}${hash}`;
}


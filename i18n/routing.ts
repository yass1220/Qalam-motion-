import {defineRouting} from "next-intl/routing";

export const localePreferenceMaxAge = 60 * 60 * 24 * 365;

export const routing = defineRouting({
  locales: ["en", "ar", "fr", "es"],
  defaultLocale: "en",
  localePrefix: "always",
  localeDetection: true,
  localeCookie: {maxAge: localePreferenceMaxAge},
});

export type Locale = (typeof routing.locales)[number];
export const localeNames: Record<Locale, string> = {
  en: "English", ar: "العربية", fr: "Français", es: "Español",
};


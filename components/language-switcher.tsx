"use client";

import type { MouseEvent } from "react";
import { useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import {
  routing,
  localeNames,
  localePreferenceMaxAge,
  type Locale,
} from "@/i18n/routing";
import { localizedHref } from "@/i18n/paths";

function subscribeLocation(onChange: () => void) {
  window.addEventListener("hashchange", onChange);
  window.addEventListener("popstate", onChange);
  return () => {
    window.removeEventListener("hashchange", onChange);
    window.removeEventListener("popstate", onChange);
  };
}

function getLocationSuffix() {
  return window.location.search + window.location.hash;
}
function getServerSuffix() {
  return "";
}

function rememberLocale(locale: Locale) {
  document.cookie = `NEXT_LOCALE=${locale}; Path=/; Max-Age=${localePreferenceMaxAge}; SameSite=Lax${window.location.protocol === "https:" ? "; Secure" : ""}`;
}

export function LanguageSwitcher({
  locale,
  label,
}: {
  locale: Locale;
  label: string;
}) {
  const pathname = usePathname();
  const suffix = useSyncExternalStore(
    subscribeLocation,
    getLocationSuffix,
    getServerSuffix,
  );

  function preserveLocation(
    event: MouseEvent<HTMLAnchorElement>,
    target: Locale,
  ) {
    // Native links keep modified/middle clicks usable; fragments only exist in the browser.
    event.currentTarget.href = localizedHref(
      window.location.pathname,
      target,
      window.location.search,
      window.location.hash,
    );
    if (event.button === 0 || event.button === 1) {
      // Remember an explicit choice even when it already matches the browser language.
      rememberLocale(target);
    }
  }

  return (
    <nav aria-label={label} className="language-switcher">
      {routing.locales.map((target) => (
        <a
          key={target}
          href={localizedHref(pathname, target) + suffix}
          hrefLang={target}
          lang={target}
          dir={target === "ar" ? "rtl" : "ltr"}
          aria-current={locale === target ? "page" : undefined}
          onClick={(event) => preserveLocation(event, target)}
          onAuxClick={(event) => preserveLocation(event, target)}
          aria-label={localeNames[target]}
          title={localeNames[target]}
        >
          {target.toUpperCase()}
        </a>
      ))}
    </nav>
  );
}

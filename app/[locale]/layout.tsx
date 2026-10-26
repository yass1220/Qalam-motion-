import type {Metadata} from "next";
import type {ReactNode} from "react";
import {notFound} from "next/navigation";
import {hasLocale} from "next-intl";
import {getTranslations} from "next-intl/server";
import {routing} from "@/i18n/routing";
import {LanguageSwitcher} from "@/components/language-switcher";
import {messages} from "@/i18n/messages";
import {pageHref, publicPages} from "@/content/public-site";
import "../globals.css";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({locale}));
}

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Metadata");
  return {title: "Qalam Motion", description: t("description"), robots: {index: false, follow: false}};
}

export default async function LocaleLayout({
  children, params,
}: {children: ReactNode; params: Promise<{locale: string}>}) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const t = await getTranslations("Navigation");
  const c = messages[locale];
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>
        <a className="skip-link" href="#main">{c.Site.skip}</a>
        <header className="site-header">
          <div className="wrap header-top"><a className="brand" href={pageHref(locale, "home")}><span className="brand-mark" aria-hidden="true">✒</span><span><strong lang="ar" dir="rtl">قلم موشن</strong><small lang="en" dir="ltr">Qalam Motion</small></span></a><LanguageSwitcher locale={locale} label={t("language")} /></div>
          <nav className="wrap main-nav" aria-label={c.Navigation.main}>{publicPages.map((page) => <a key={page} href={pageHref(locale, page)}>{c.Navigation[page]}</a>)}</nav>
        </header>
        {children}
        <footer className="site-footer"><div className="wrap footer-inner"><p><bdi>Qalam Motion</bdi><br /><span>{c.Site.tagline}</span></p><nav aria-label={c.Navigation.footer}><a href={pageHref(locale, "studio")}>{c.Navigation.studio}</a><a href={pageHref(locale, "contact")}>{c.Navigation.contact}</a><a href={pageHref(locale, "faq")}>{c.Navigation.faq}</a></nav></div></footer>
      </body>
    </html>
  );
}


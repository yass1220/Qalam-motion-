import type {Metadata} from "next";
import type {ReactNode} from "react";
import {notFound} from "next/navigation";
import {hasLocale} from "next-intl";
import {getTranslations} from "next-intl/server";
import {routing} from "@/i18n/routing";
import {LanguageSwitcher} from "@/components/language-switcher";
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
  return (
    <html lang={locale} dir={locale === "ar" ? "rtl" : "ltr"}>
      <body>
        <header className="mx-auto max-w-3xl px-6 pt-6">
          <LanguageSwitcher locale={locale} label={t("language")} />
        </header>
        {children}
      </body>
    </html>
  );
}


import type {Metadata} from "next";
import {hasLocale} from "next-intl";
import {notFound} from "next/navigation";
import {PublicPageContent} from "@/components/public-page";
import {pageCopy} from "@/content/public-site";
import {routing} from "@/i18n/routing";

type Props = {params: Promise<{locale: string}>};
export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  const copy = pageCopy(locale, "home");
  return {title: `${copy.title} | Qalam Motion`, description: copy.description};
}
export default async function HomePage({params}: Props) {
  const {locale} = await params;
  if (!hasLocale(routing.locales, locale)) notFound();
  return <PublicPageContent locale={locale} page="home" />;
}


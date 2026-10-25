import type {Metadata} from "next";
import {hasLocale} from "next-intl";
import {notFound} from "next/navigation";
import {PublicPageContent} from "@/components/public-page";
import {isPublicSlug, pageCopy, publicSlugs} from "@/content/public-site";
import {routing} from "@/i18n/routing";

type Props = {params: Promise<{locale: string; page: string}>};
export function generateStaticParams() {
  return publicSlugs.map((page) => ({page}));
}
export async function generateMetadata({params}: Props): Promise<Metadata> {
  const {locale, page} = await params;
  if (!hasLocale(routing.locales, locale) || !isPublicSlug(page)) notFound();
  const copy = pageCopy(locale, page);
  return {title: `${copy.title} | Qalam Motion`, description: copy.description};
}
export default async function InformationalPage({params}: Props) {
  const {locale, page} = await params;
  if (!hasLocale(routing.locales, locale) || !isPublicSlug(page)) notFound();
  return <PublicPageContent locale={locale} page={page} />;
}

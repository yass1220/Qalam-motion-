import {getTranslations} from "next-intl/server";
import {Link} from "@/i18n/navigation";

export default async function NotFoundPage() {
  const t = await getTranslations("NotFound");
  const navigation = await getTranslations("Navigation");
  return (
    <main id="main" tabIndex={-1} className="wrap section reading space-y-6">
      <h1 className="text-3xl font-semibold">{t("title")}</h1>
      <p>{t("description")}</p>
      <Link href="/" className="inline-flex min-h-11 items-center underline focus-visible:outline-2">{navigation("home")}</Link>
    </main>
  );
}


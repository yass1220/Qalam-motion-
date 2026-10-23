import {getTranslations} from "next-intl/server";

export default async function HomePage() {
  const t = await getTranslations("Home");
  return (
    <main className="mx-auto flex min-h-[80vh] max-w-3xl flex-col justify-center gap-6 px-6 py-16">
      <p className="text-sm font-medium tracking-widest uppercase"><bdi>Qalam Motion</bdi></p>
      <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">{t("title")}</h1>
      <p className="max-w-xl text-lg leading-relaxed text-neutral-600">{t("description")}</p>
    </main>
  );
}


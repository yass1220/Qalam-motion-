import { getLocale, getTranslations } from "next-intl/server";
import { CraftStudy, Flourish, StudioReel } from "@/components/studio-art";
import { ArrowIcon } from "@/components/arrow-icon";

const creatorTools = {
  ar: {
    label: "أدوات لصنّاع المحتوى",
    title: "من النص إلى الصوت",
    intro: "مورد مستقل لمن يصنع محتواه بنفسه.",
    description: "حوّل النص إلى مسودة تعليق صوتي، ثم راجع النطق والإيقاع قبل إضافته إلى الفيديو.",
    disclosure: "رابط بالعمولة: قد نحصل على عمولة عند الاشتراك من خلاله.",
    action: "جرّب أداة الصوت",
    independence: "قلم موشن مستقل. هذا المحتوى غير معتمد أو ممول من ElevenLabs. الأسعار والاشتراك لدى مزوّد الأداة.",
  },
  en: {
    label: "Creator tools",
    title: "From text to voice",
    intro: "An independent resource for people making their own content.",
    description: "Turn text into a voiceover draft, then review pronunciation and pacing before adding it to your video.",
    disclosure: "Affiliate link: we may earn a commission when you subscribe through it.",
    action: "Try the voice tool",
    independence: "Qalam Motion is independent. This content is not endorsed or sponsored by ElevenLabs. Pricing and subscriptions are handled by the tool provider.",
  },
  fr: {
    label: "Outils pour les créateurs",
    title: "Du texte à la voix",
    intro: "Une ressource indépendante pour créer votre propre contenu.",
    description: "Transformez un texte en première version de voix off, puis vérifiez la prononciation et le rythme avant de l’ajouter à votre vidéo.",
    disclosure: "Lien d’affiliation : nous pouvons percevoir une commission si vous vous abonnez via ce lien.",
    action: "Essayer l’outil vocal",
    independence: "Qalam Motion est indépendant. Ce contenu n’est ni approuvé ni sponsorisé par ElevenLabs. Les tarifs et abonnements sont gérés par le fournisseur de l’outil.",
  },
  es: {
    label: "Herramientas para creadores",
    title: "Del texto a la voz",
    intro: "Un recurso independiente para quienes crean su propio contenido.",
    description: "Convierte el texto en un borrador de voz en off y revisa la pronunciación y el ritmo antes de añadirlo a tu vídeo.",
    disclosure: "Enlace de afiliado: podemos recibir una comisión si te suscribes a través de él.",
    action: "Probar la herramienta de voz",
    independence: "Qalam Motion es independiente. Este contenido no está avalado ni patrocinado por ElevenLabs. El proveedor de la herramienta gestiona los precios y las suscripciones.",
  },
};

export default async function HomePage() {
  const [t, locale] = await Promise.all([getTranslations("Home"), getLocale()]);
  const tools = creatorTools[locale as keyof typeof creatorTools] ?? creatorTools.en;
  return (
    <main id="main">
      <section className="hero wrap">
        <div className="hero-copy">
          <p className="eyebrow">
            <span className="little-star" aria-hidden="true">
              ✳
            </span>
            {t("eyebrow")}
          </p>
          <h1>
            {t("title")}
            <br />
            {t("titleMiddle")}
            <br />
            <em className="ink-word">
              {t("titleAccent")}
              <svg
                viewBox="0 0 380 20"
                preserveAspectRatio="none"
                aria-hidden="true"
              >
                <path d="M3 13Q167 0 374 8M19 18Q203 5 363 14" />
              </svg>
            </em>
          </h1>
          <p className="hero-description">{t("description")}</p>
          <div className="hero-actions">
            <a className="button" href="#contact">
              {t("primary")}
              <ArrowIcon />
            </a>
            <a className="underlink" href="#craft">
              {t("secondary")}
              <ArrowIcon down />
            </a>
          </div>
          <p className="hero-note">
            <span aria-hidden="true">⌁</span>
            {t("note")}
          </p>
        </div>
        <StudioReel
          label={t("reelLabel")}
          previous={t("previousFrame")}
          next={t("nextFrame")}
          titles={[
            t("filmJustice"),
            t("filmRidicule"),
            t("filmHearts"),
            t("filmDoors"),
            t("filmUnderstand"),
          ]}
          demo={t("demo")}
          alt={t("artAlt")}
        />
      </section>
      <div className="values-strip">
        <div className="wrap">
          <span>{t("strip1")}</span>
          <span aria-hidden="true">✳</span>
          <span>{t("strip2")}</span>
          <span aria-hidden="true">✳</span>
          <span>{t("strip3")}</span>
          <span aria-hidden="true">✳</span>
          <span className="strip-brand">QALAM MOTION</span>
        </div>
      </div>
      <section className="craft-section wrap section" id="craft">
        <div className="section-copy">
          <p className="eyebrow">{t("craftLabel")}</p>
          <h2>
            {t("craftTitle")}
            <br />
            <em>{t("craftAccent")}</em>
          </h2>
          <p>{t("craftDescription")}</p>
          <Flourish className="craft-flourish" />
        </div>
        <CraftStudy
          sketch={t("sketch")}
          color={t("color")}
          motion={t("motion")}
          sketchNote={t("sketchNote")}
          colorNote={t("colorNote")}
          motionNote={t("motionNote")}
        />
      </section>
      <section className="offers-section section" id="films">
        <div className="wrap">
          <div className="section-heading">
            <div>
              <p className="eyebrow">{t("offersLabel")}</p>
              <h2>
                {t("offersTitle")}
                <br />
                <em>{t("offersAccent")}</em>
              </h2>
            </div>
            <p>{t("offersDescription")}</p>
          </div>
          <div className="offers-grid">
            {(
              [
                {
                  name: "short",
                  description: "shortDescription",
                  duration: "shortDuration",
                  price: 15,
                },
                {
                  name: "signature",
                  description: "signatureDescription",
                  duration: "signatureDuration",
                  price: 25,
                },
              ] as const
            ).map((offer, i) => (
              <article className="offer" key={offer.name}>
                <div className="offer-number" aria-hidden="true">
                  0{i + 1}
                  <span>{i === 0 ? "✳" : "✺"}</span>
                </div>
                <h3>{t(offer.name)}</h3>
                <p>{t(offer.description)}</p>
                <div className="offer-bottom">
                  <div>
                    <span className="price">
                      <bdi>${offer.price}</bdi>
                    </span>
                    <span className="price-unit">{t("perFilm")}</span>
                  </div>
                  <span className="duration">{t(offer.duration)}</span>
                </div>
                <a
                  className="offer-link"
                  href={`/order.html?package=${offer.name}#order`}
                >
                  {t("choose")}
                  <ArrowIcon />
                </a>
              </article>
            ))}
          </div>
          <p className="included-note">{t("included")}</p>
        </div>
      </section>
      <section className="process-section wrap section" id="process">
        <p className="eyebrow">{t("processLabel")}</p>
        <h2>
          {t("processTitle")}
          <br />
          <em>{t("processAccent")}</em>
        </h2>
        <div className="process-grid">
          {([1, 2, 3] as const).map((i) => (
            <article key={i}>
              <span className="step-number">
                0{i}
                <svg viewBox="0 0 70 65" aria-hidden="true">
                  <path d="M63 27C65 2 9 1 6 28S20 63 45 56 66 35 63 22" />
                </svg>
              </span>
              <h3>{t(`step${i}`)}</h3>
              <p>{t(`step${i}Text`)}</p>
            </article>
          ))}
        </div>
      </section>
      <section className="contact-section" id="contact">
        <div className="wrap contact-inner">
          <div>
            <p className="eyebrow">{t("contactLabel")}</p>
            <h2>
              {t("contactTitle")}
              <br />
              <em>{t("contactAccent")}</em>
            </h2>
            <p>{t("contactText")}</p>
          </div>
          <div className="contact-action">
            <Flourish />
            <a className="button button-cream" href="/order.html#order">
              {t("contactButton")}
              <ArrowIcon />
            </a>
            <p>{t("emailNote")}</p>
          </div>
        </div>
      </section>
      <section className="wrap section" id="tools" aria-labelledby="creator-tools-title">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{tools.label}</p>
            <h2 id="creator-tools-title">{tools.title}</h2>
          </div>
          <p>{tools.intro}</p>
        </div>
        <article className="offer">
          <h3><bdi>ElevenLabs</bdi></h3>
          <p>{tools.description}</p>
          <p style={{ color: "var(--ink)", marginBlock: "20px 12px", lineHeight: 1.8 }}>
            {tools.disclosure}
          </p>
          <a
            className="button"
            href="https://try.elevenlabs.io/ba3xgbf15lrb"
            target="_blank"
            rel="sponsored noopener noreferrer"
          >
            {tools.action}<ArrowIcon />
          </a>
          <p style={{ marginTop: 18, lineHeight: 1.8 }}>{tools.independence}</p>
        </article>
      </section>
      <footer className="wrap footer">
        <div>
          <a className="footer-brand" href="#main">
            Qalam Motion<span aria-hidden="true">✳</span>
          </a>
          <p>{t("footer")}</p>
        </div>
        <div className="footer-end">
          <a href="mailto:yassah1220@gmail.com">yassah1220@gmail.com <ArrowIcon /></a>
          {process.env.NODE_ENV !== "production" && <p>{t("footerNote")}</p>}
          <a className="tracking-link" href="/status.html">
            {t("trackOrder")}
          </a>
          <a className="tracking-link" href="#tools">{tools.label}</a>
          <nav aria-label={t("policies")}>
            <a href="/terms.html">{t("terms")}</a>{" · "}
            <a href="/privacy.html">{t("privacy")}</a>{" · "}
            <a href="/refunds.html">{t("refunds")}</a>
          </nav>
          <span>© 2026 Qalam Motion</span>
        </div>
      </footer>
    </main>
  );
}

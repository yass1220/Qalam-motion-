import { getTranslations } from "next-intl/server";
import { CraftStudy, Flourish, StudioReel } from "@/components/studio-art";
const email =
  "mailto:yassah1220@gmail.com?subject=Qalam%20Motion%20%E2%80%94%20My%20story";
export default async function HomePage() {
  const t = await getTranslations("Home");
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
              <span aria-hidden="true">↗</span>
            </a>
            <a className="underlink" href="#craft">
              {t("secondary")}
              <span aria-hidden="true">↘</span>
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
                  href={`${email}%20%2F%20${offer.name}`}
                >
                  {t("choose")}
                  <span aria-hidden="true">↗</span>
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
            <a className="button button-cream" href={email}>
              {t("contactButton")}
              <span aria-hidden="true">↗</span>
            </a>
            <p>{t("emailNote")}</p>
          </div>
        </div>
      </section>
      <footer className="wrap footer">
        <div>
          <a className="footer-brand" href="#main">
            Qalam Motion<span aria-hidden="true">✳</span>
          </a>
          <p>{t("footer")}</p>
        </div>
        <div className="footer-end">
          <a href="mailto:yassah1220@gmail.com">yassah1220@gmail.com ↗</a>
          {process.env.NODE_ENV !== "production" && <p>{t("footerNote")}</p>}
          <a className="tracking-link" href="/status.html">
            {t("trackOrder")}
          </a>
          <span>© 2026 Qalam Motion</span>
        </div>
      </footer>
    </main>
  );
}

import Image from "next/image";
import {messages} from "@/i18n/messages";
import type {Locale} from "@/i18n/routing";
import {packages, pageCopy, pageHref, studioEmail, type PublicPage} from "@/content/public-site";

function TechnicalText({children}: {children: string}) {
  // Numeric ranges and dimensions have no strong directional character of their own.
  return children.split(/(\d+(?:\s*[×:–]\s*\d+)*)/g).map((part, index) =>
    /^\d/.test(part) ? <bdi dir="ltr" key={index}>{part}</bdi> : part,
  );
}

export function PublicPageContent({locale, page}: {locale: Locale; page: PublicPage}) {
  const c = messages[locale];
  const copy = pageCopy(locale, page);
  const contactHref = pageHref(locale, "contact");
  const currency = new Intl.NumberFormat(locale, {style: "currency", currency: "USD", currencyDisplay: "code", maximumFractionDigits: 0});
  return (
    <main id="main" tabIndex={-1}>
      <section className={page === "home" ? "hero" : "page-intro"}>
        {page === "home" && <Image className="hero-art" src="/hero-parchment.webp" alt="" width={1672} height={941} sizes="100vw" preload />}
        <div className="wrap intro-copy">
          <p className="studio-label">{c.Site.tagline}</p><h1>{copy.title}</h1><p className="lead">{copy.description}</p>
          {page === "home" && <div className="actions"><a className="button" href={contactHref}>{c.Site.cta}</a><a className="button secondary" href={pageHref(locale, "services")}>{c.Navigation.services}</a></div>}
        </div>
      </section>
      {(page === "home" || page === "services") && <section className="section wrap" aria-labelledby="services-title">
        <div className="section-heading"><h2 id="services-title">{c.Services.title}</h2><p>{c.Services.intro}</p></div>
        <div className="service-grid">{Object.entries(c.Services.items).map(([key, item]) => <article key={key} className="service"><h3>{item.title}</h3><p>{item.body}</p></article>)}</div>
        <p className="note"><TechnicalText>{c.Services.scope}</TechnicalText></p><a className="text-link" href={pageHref(locale, page === "home" ? "services" : "pricing")}>{page === "home" ? c.Site.servicesLink : c.Site.pricingLink}</a>
      </section>}
      {(page === "home" || page === "process") && <section className="section section-tinted" aria-labelledby="process-title"><div className="wrap">
        <div className="section-heading"><h2 id="process-title">{c.Process.title}</h2><p>{c.Process.intro}</p></div>
        <ol className="process-list">{Object.entries(c.Process.steps).map(([key, step]) => <li key={key}><h3>{step.title}</h3><p>{step.body}</p></li>)}</ol>
        {page === "home" ? <a className="text-link" href={pageHref(locale, "process")}>{c.Site.processLink}</a> : <p className="note">{c.Process.timing}</p>}
      </div></section>}
      {page === "pricing" && <section className="section wrap" aria-labelledby="plans-title">
        <div className="section-heading"><h2 id="plans-title">{c.Pricing.title}</h2><p><TechnicalText>{c.Pricing.intro}</TechnicalText></p></div>
        <div className="plans">{packages.map((plan) => <article key={plan.id} className={`plan ${plan.id === "signature" ? "plan-extended" : ""}`}>
          <h3>{c.Pricing[plan.id].name}</h3><p>{c.Pricing[plan.id].purpose}</p>
          <p className="price"><bdi>{currency.format(plan.price)}</bdi><span>{c.Pricing.perVideo}</span></p>
          <p className="duration"><bdi dir="ltr">{plan.duration}</bdi> {c.Pricing.seconds}</p>
          <ul className="features">{Object.entries(c.Pricing.features).map(([key, feature]) => <li key={key}><TechnicalText>{feature}</TechnicalText></li>)}</ul>
          <a className="button" href={contactHref}>{c.Site.cta}</a>
        </article>)}</div>
        <div className="reading pricing-notes"><h2>{c.Pricing.beforeTitle}</h2><p>{c.Pricing.voice}</p><p>{c.Pricing.custom}</p><p>{c.Pricing.payment}</p></div>
      </section>}
      {page === "faq" && <section className="section wrap reading" aria-label={c.Pages.faq.title}>
        <div className="faq-list">{Object.entries(c.Faq).map(([key, item]) => <details key={key}><summary>{item.question}</summary><p><TechnicalText>{item.answer}</TechnicalText></p></details>)}</div>
        <p className="note">{c.Site.moreQuestions}</p><a className="text-link" href={contactHref}>{c.Site.cta}</a>
      </section>}
      {page === "studio" && <section className="section wrap reading" aria-labelledby="studio-title">
        <h2 id="studio-title">{c.Studio.title}</h2><p>{c.Studio.approach}</p><h2>{c.Studio.visualTitle}</h2><p>{c.Studio.visual}</p><h2>{c.Studio.careTitle}</h2><p>{c.Studio.care}</p><a className="text-link" href={pageHref(locale, "process")}>{c.Site.processLink}</a>
      </section>}
      {page === "contact" && <section className="section wrap contact-grid" aria-labelledby="brief-title">
        <div><h2 id="brief-title">{c.Contact.briefTitle}</h2><p>{c.Contact.intro}</p><ul className="brief-list">{Object.entries(c.Contact.brief).map(([key, item]) => <li key={key}>{item}</li>)}</ul><p className="note">{c.Contact.safety}</p></div>
        <aside className="contact-panel" aria-labelledby="email-title"><h2 id="email-title">{c.Contact.emailTitle}</h2><p>{c.Contact.emailIntro}</p><a className="email-address" href={`mailto:${studioEmail}`}><bdi>{studioEmail}</bdi></a><a className="button" href={`mailto:${studioEmail}?subject=${encodeURIComponent(c.Contact.subject)}`}>{c.Contact.emailAction}</a><p className="small">{c.Contact.mailHint}</p><p>{c.Contact.next}</p></aside>
      </section>}
      {page !== "contact" && <section className="contact-band"><div className="wrap contact-inner"><div><h2>{c.Site.contactTitle}</h2><p>{c.Site.contactBody}</p></div><a className="button" href={contactHref}>{c.Site.cta}</a></div></section>}
    </main>
  );
}

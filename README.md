# Qalam Motion

Next.js 16 App Router, strict TypeScript, React and Tailwind CSS v4.

## Structure

```text
app/                      Application routes, layout and styles
docs/CAHIER-DES-CHARGES.md Product and technical specification
```

The application lives directly at the repository root, without `src/` or a workspace
wrapper. The `@/*` alias resolves from this root. Executable configuration uses
TypeScript; PostCSS uses declarative JSON.

## Development

Use Node.js 22.13 or later and pnpm 10.28.2.

```bash
pnpm install --frozen-lockfile
pnpm dev --port 3155
```

Port 3155 belongs to the `next-foundation` sandbox. Use the assigned port when working
in another sandbox. No environment variables or database are required for this initial
foundation.

## Validation

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm start --port 3155
```

With the production preview running, `pnpm test:http` checks the 28 localized HTML
pages, prerender manifest, root negotiation and translated 404 responses. Override `I18N_TEST_BASE_URL`
when using another local port. CI starts an isolated preview after the build and runs
this HTTP matrix in addition to the six catalog/routing tests.

The public preview contains seven page families in all four locales (28 prerendered
URLs): home (`/en`, `/ar`, `/fr`, `/es`), plus shared slugs `/services`, `/process`,
`/pricing`, `/faq`, `/studio`, and `/contact` beneath each locale. Samy approved this
inventory and retention of the historical parchment/olive design on 2026-10-23.
Pages remain `noindex` until human content/translation review and launch SEO are ready.
The root negotiates a language:
explicit URL first, saved `NEXT_LOCALE` preference second, browser language third,
English fallback last. A manual selection is remembered for one year. Arabic uses
RTL; other languages use LTR. Unknown pages return a translated 404.

`next-intl` provides routing and typed translation keys. The `[locale]` root layout
and `next/root-params` keep the public pages prerendered. Catalog parity and
negotiation tests run with `pnpm test`; future forms must add their own translated
validation messages. Language links preserve the route, query and fragment when
activated. Slugs remain shared in this foundation; translated slugs require a
separate page/content decision before published URLs are introduced.

## Public page preview — issue #15

The four catalogs contain complete draft copy, navigation, FAQ, metadata and
contact instructions. Human approval of all translations and commercial/religious
wording is still required. No portfolio, case study or legal policy is published.
The decorative hero image is restored from `355ca11:public/hero-parchment.webp`
(1672 × 941); no client portfolio media is reused.

The existing package contract stays in `content/public-site.ts`: `short` is
15 USD / 40–45 seconds and `signature` is 25 USD / 60–75 seconds. Both include
vertical 9:16 delivery at 1080 × 1920, Arabic voiceover on request, no music and
one revision within the agreed scope. No new turnaround promise is introduced.

Contact uses the existing public email address and an explicitly labelled mailto
draft link, which sends nothing from the site. The enquiry form, server validation,
pending/success/error feedback and duplicate-submission prevention await the #13
integration. No checkout or order-tracking route is implied by this preview.
Final canonicals, hreflang, sitemap and indexing decisions remain in #17.

`pnpm test:http` now checks all 28 routes, localized visible HTML after removing
hydration scripts, metadata, page-preserving language links, package values,
native FAQ answers, mailto contact and translated 404s, including deferred routes.
It also checks `.next/prerender-manifest.json` for all 28 SSG routes with no timed
revalidation. Run it against a production build, with `I18N_TEST_BASE_URL` set to
the sandbox URL (this task uses `http://127.0.0.1:3801`).

Legacy order, payment and administration workflows have not been migrated yet. Their
reference implementation and regression scenarios remain at commit
`981706e736d884f7d9769c848ed89630567a4144` in Git history. This foundation does not replace the running production service. Implement
and validate each domain before any separately approved production migration.

## Validated development baseline

Samy approved this root-level structure on 2026-10-23. Use this application and
`docs/CAHIER-DES-CHARGES.md` as the starting point for subsequent issues: no `src/`,
no `apps/web/`, no workspace wrapper, and new application code in strict TypeScript.
Issue #8 covers this foundation. Runtime form validation belongs to #13, UI primitives
to #15 and migration/regression coverage to #18. The initial CI runs frozen install,
lint, strict typecheck and production build. Issue #9 adds catalog/routing tests;
legacy business tests are not yet ported. Issue #15 now has a local public-page
preview; final human content approval and the enquiry integration remain pending.

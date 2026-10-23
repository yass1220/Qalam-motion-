# Qalam Motion — Product & Technical Specification v1

**Status:** Approved by Samy as the development specification. Yassine's approval is not asserted. Publication of this specification on the repository's `dev` branch is authorized; implementation, deployment, purchases and final legal commitments require separate approval.
**Language:** English for sharing. Public site locales: English, Arabic, French and Spanish.

## 1. Objective

Replace the current single public landing page and associated transaction/admin pages with a robust, multilingual, multi-page website using Samy's stack. Increase discoverability and conversion while preserving existing enquiries, orders, payment safeguards and business records.

The audited homepage is already substantive static HTML served by Express; it is not an established client-rendered SPA. The requirement is to expand it into a properly structured multi-page website, not to fix an assumed absence of indexable HTML.

## 2. Confirmed requirements

- Next.js 16 App Router and strict TypeScript.
- Repository convention confirmed by Samy: no `src/` directory. Place the App Router directly under the Next.js application root and write new application code in strict TypeScript. Use TypeScript tooling configuration where supported, or declarative JSON rather than JavaScript.
- Layout clarification confirmed by Samy: the repository working tree is the new Next.js application itself, with `app/` at its root and this specification under `docs/`. Do not introduce `apps/web/`, a workspace wrapper or legacy Express files into this application. Legacy business code and its 19 regression scenarios remain reference material on `dev` until their corresponding migration work is implemented; removing them from the new foundation is not a production cutover or permission to discard business records.
- Better Auth for authentication; authorization remains enforced server-side.
- Multiple public pages with indexable, pre-rendered content.
- Public content available in English (`en`), Arabic (`ar`), French (`fr`) and Spanish (`es`).
- Samy's clarification on 2026-10-23: English is the base/fallback language. On an initial visit without an explicit locale or previous language selection, negotiate a supported locale from the browser language (including Arabic phones). Preserve explicit locale URLs and subsequent language selections. Initialize the Next.js/TypeScript foundation before implementing locale detection.
- Arabic RTL; English/French/Spanish LTR.
- Public informational pages rendered ahead of requests and served from cache/static output rather than regenerated for each visitor.
- Preserve existing payment/order data and integrity controls.
- Prepare a clear specification and manual implementation backlog; no automated code changes or publication at this stage.

## 3. Team-stack planning baseline

Tailwind CSS v4, shadcn/ui, PostgreSQL, Prisma, React Hook Form/Zod and pnpm, aligned with the team's established stack. Prisma migration must preserve transactional SQL and outbox guarantees. tRPC/TanStack Query may support authenticated interactive workflows where useful; they are not mandatory dependencies for public pages.

Resend remains the proposed email delivery service. Better Auth verification/recovery/sign-in messages use Resend where the selected authentication mode requires them. Keep a durable PostgreSQL notification outbox and an explicit worker/scheduler appropriate to hosting.

Pin supported, patched versions at implementation time; do not assume the newest major automatically satisfies the requested Next.js 16 baseline.

## 4. Rendering and caching contract

### Public content: SSG first, controlled revalidation if required

For content that changes only with releases, generate each localized page at build time (SSG) and serve the generated output directly. For owner-editable content requiring updates between releases, evaluate ISR/on-demand revalidation after the content-management decision. Regeneration is intentional after content changes, not once for the lifetime of the site.

Server Components are the default composition model; this alone does not prove a route is statically generated. Confirm the actual production build output and request behavior. Keep request-time cookies/session reads out of static marketing routes.

### Private and transactional routes: dynamic

Authentication, administration, personal order tracking and payment mutations require request-time processing and appropriate cache isolation. Never share-cache personal/session/payment data. Interactive forms may use small client components; full static export is not the deployment model for an application containing Better Auth, PostgreSQL and payment handlers.

### Acceptance

- Every agreed localized public URL returns substantive HTML, localized metadata and the correct language/direction without client JavaScript.
- Production build evidence identifies marketing routes as prerendered; hosting tests verify caching and intentional invalidation.
- Private information is never included in generated public HTML or reused between users.

## 5. Proposed information architecture — pending approval

Use stable locale-prefixed URLs, for example `/en/`, `/ar/`, `/fr/`, `/es/`. Localized slugs versus shared slugs require one consistent decision before implementation.

Suggested page families:
1. Home.
2. Services overview and distinct service pages only where each has meaningful original content.
3. Portfolio and approved project/case-study pages.
4. Process / how it works.
5. Pricing and included scope.
6. FAQ.
7. About / studio identity.
8. Contact / enquiry.
9. Terms, privacy and refund policy.

Separate dynamic areas: order status, payment return/cancel, sign-in and protected administration. A customer account portal, blog, CMS, payment-provider expansion or automated video generation are not included unless separately approved.

**Open decision:** approve the exact page inventory and useful content for each locale. Do not mass-generate thin pages solely to target search terms. SEO performance or rankings cannot be guaranteed by page count or framework choice.

## 6. Internationalization requirements

- Adopt a maintained App Router-compatible internationalization solution; `next-intl` is a candidate, not a confirmed selection.
- Publish complete approved translations for the four locales: content, navigation, forms, validation, accessibility labels, metadata, error messages and legal text.
- Human review of commercial/religious wording and legal translations; no invented promises or pricing changes.
- Each locale has its own indexable URL, self-referencing canonical and reciprocal `hreflang` references to actual equivalents. Define a deliberate `x-default` destination.
- Add a language selector that retains the equivalent page when available and has a clear fallback when unavailable.
- Explicit locale URLs remain stable regardless of browser language/cookies. Define root routing without redirect loops or forcing visitors away from a selected locale.
- Format numbers/dates/currency appropriately while preserving the actual USD price contract unless multi-currency is separately approved.
- Localize customer-facing transactional/authentication email templates and persist the customer's chosen locale for delayed delivery. Missing templates use an explicitly approved fallback.
- Arabic layout mirrors appropriately, not blindly: email addresses, references, code and relevant numerical strings retain readable direction.

### Acceptance

- Build/tests validate translation completeness and locale routing.
- Each page family works in all four locales; translated alternates are valid and mutually linked.
- RTL/LTR, mobile, long text, keyboard and screen-reader checks cover representative pages and forms.
- No untranslated fallback silently appears on a published critical path.

### Google indexing and language selection — verified requirements

Google can discover and index all four translated versions; i18n itself neither restricts indexing to one language nor guarantees that every URL will be indexed. Each published translation must have a distinct crawlable URL and genuinely translated main content. A single URL whose language changes only through JavaScript, cookies or Accept-Language is not the target architecture.

- Generate each approved page/locale combination with SSG; return 200 and complete localized HTML at its stable URL.
- Use self-referencing canonicals for each translated page, never canonicalize all four languages to English or another single language.
- Emit reciprocal, fully qualified hreflang links for en/ar/fr/es, including the current version and only published equivalents. Use language-only codes unless regional targeting is explicitly required.
- Choose one authoritative hreflang implementation (HTML metadata is the proposed baseline); a sitemap must list published URLs, but duplicating hreflang across HTML and sitemap is optional rather than a ranking benefit.
- Fully translate main content and navigation. Google determines page language primarily from visible content, not merely lang attributes, URL prefixes or hreflang. Keep correct lang/dir for accessibility and browser behavior.
- Google uses hreflang to help surface the appropriate version, but language selection is not guaranteed. Do not promise that a visitor can never reach another language.
- Keep a visible language selector with real links to equivalent pages. A non-blocking suggestion is acceptable; do not forcibly redirect explicit locale URLs based on IP, browser language or cookies.
- x-default identifies a deliberate fallback, ideally a language selector or approved fallback destination. Root/default-language choice remains an owner decision.
- At staging, validate rendered metadata, reciprocal links, self-canonicals, sitemap, status codes and no unintended noindex/robots blocking across all four locales. After approved release, inspect representative locale URLs with Search Console and monitor discovery/indexing separately from ranking or selected search-result language.

Official Google sources checked for this specification:
- https://developers.google.com/search/docs/specialty/international/localized-versions
- https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites

## 7. SEO and performance

- Unique, accurate localized titles/descriptions, canonical URLs and social-sharing metadata.
- XML sitemap containing published public locale URLs and their language alternates; robots/noindex strategy for private/transaction routes.
- Semantic headings, descriptive internal links, accessible image alternatives and truthful structured data where applicable.
- Preserve existing indexed URLs through a reviewed redirect map, including current `.html` routes. Do not redirect unrelated pages indiscriminately to the homepage.
- Responsive images, correct dimensions/preloads, controlled font loading, lazy portfolio media and minimal client JavaScript.
- Measure mobile lab performance before/after; use field p75 targets when data exists: LCP <=2.5s, INP <=200ms, CLS <=0.1. Targets are not measured outcomes.
- Verify canonical domain and search/analytics ownership before configuring tools; no paid marketing authorization.

## 8. Functional and security invariants

- Preserve enquiry-first flow, existing packages and prices, and optional PayPal checkout unless owner approves a change.
- Validate requests/configuration at runtime; sanitize errors and logging; ensure failed requests cannot terminate the service.
- Better Auth administrator accounts provisioned through controlled access; no open admin signup or client-assignable privilege.
- Check validated sessions and permissions in every protected data/API/action boundary; a proxy redirect or cookie presence is not sufficient.
- Preserve webhook verification, amount/currency/reference validation, capture uniqueness, payment reconciliation and atomic outbox writes.
- Ensure provider timeouts, controlled storage failure/recovery, durable workers and notification deduplication.
- No implicit linking of old orders to new users by unverified email matching.
- Fix admin pagination/full-dataset totals and ensure private exports remain protected.
- Verify backups and an isolated restore before migration. A rewrite must not postpone urgent existing availability fixes.

## 9. Quality gates and release

- CI: frozen dependency installation, lint, strict typecheck, unit/integration tests and production build.
- Preserve the original 19 regression scenarios; add localization, static-rendering, auth/revocation, malformed-input survival, webhook and concurrency tests.
- Browser tests cover four-locale representative paths, enquiry, payment return/cancel, status and admin login/logout.
- Use synthetic fixtures and isolated PostgreSQL; no live payments or real customer messages in automated tests.
- Stage and rehearse additive data migrations, worker ownership, redirects, auth provisioning, backup/restore and rollback.
- Owner approval required for production cutover, final policy wording, account/provider changes and any recurring cost.

## 10. Proposed delivery sequence

1. Approve page inventory, audience, content ownership and authentication scope.
2. Establish Next.js/TypeScript foundation, locale routing and static-rendering proof.
3. Prepare additive storage/auth schemas and server-side permissions.
4. Port validated business/payment/outbox contracts with regression coverage.
5. Implement localized public pages and protected admin interface.
6. Complete translated content, metadata, redirects, accessibility and mobile measurements.
7. Rehearse recovery/cutover, then release only with owner approval.

The existing `NEXT16-BETTER-AUTH-ISSUES.md` is the technical starting backlog. Expand its public-page issue into page-inventory/content, i18n/RTL, static rendering/cache, localized SEO and localized transactional-email work before manual issue creation.

## 11. Decisions still needed

- Exact public page inventory and launch content in each locale.
- Main audience, preferred root/default language and canonical domain.
- Preserve/refine current design versus a broader redesign.
- Who supplies and approves translations and portfolio permissions.
- Static content in the repository versus a CMS requiring content revalidation.
- Administrator login method and whether customer accounts are needed at all.
- Hosting/worker topology, budget constraints and current backup coverage.
- Schedule and release scope; no delivery estimate is committed by this draft.

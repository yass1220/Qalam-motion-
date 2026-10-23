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

With the production preview running, `pnpm test:http` checks the four localized HTML
pages, root negotiation and translated 404 responses. Override `I18N_TEST_BASE_URL`
when using another local port. CI starts an isolated preview after the build and runs
this HTTP matrix in addition to the six catalog/routing tests.

The preview homepage is available at `/en`, `/ar`, `/fr` and `/es`, and remains
`noindex` until launch content and SEO are ready. The root negotiates a language:
explicit URL first, saved `NEXT_LOCALE` preference second, browser language third,
English fallback last. A manual selection is remembered for one year. Arabic uses
RTL; other languages use LTR. Unknown pages return a translated 404.

`next-intl` provides routing and typed translation keys. The `[locale]` root layout
and `next/root-params` keep the four homepages prerendered. Catalog parity and
negotiation tests run with `pnpm test`; future forms must add their own translated
validation messages. Language links preserve the route, query and fragment when
activated. Slugs remain shared in this foundation; translated slugs require a
separate page/content decision before published URLs are introduced.

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
legacy business tests are not yet ported. Full public pages remain in #15.

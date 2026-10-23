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
pnpm build
pnpm start --port 3155
```

The initial page is English and marked `noindex`. The next localization step adds
Arabic, French and Spanish, with English as the fallback and browser language
detection on initial visits. Explicit locale URLs and manual choices must remain
stable.

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
lint, strict typecheck and production build; it does not claim that legacy tests run
in this new application yet. Next work starts with locale routing in #9.

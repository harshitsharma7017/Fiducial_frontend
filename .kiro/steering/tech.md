# Tech (frontend)

## Stack (pinned exact versions)

- Node.js 24 LTS (`.nvmrc`), TypeScript 6.0 (`strict`), ESM.
- Next.js 16 (App Router, Turbopack), React 19, TanStack Query 5, React Hook Form + Zod 4, Tailwind CSS 4,
  shadcn-style components on `radix-ui`, lucide-react.
- Tests: Vitest 5, Testing Library, jsdom.
- Tooling: ESLint 9 (flat config: `eslint-config-next` core web vitals + type-aware typescript-eslint), Prettier,
  Husky + lint-staged, GitHub Actions. ESLint stays on 9 until the plugins in `eslint-config-next` support 10.

## Commands

`npm run dev` · `npm run lint` · `npm run typecheck` · `npm test` · `npm run build` · `npm run shared:check` ·
`npm run shared:sync`

## Conventions

- **The token never reaches the browser.** Browser code calls `apiFetch()` (`src/lib/api-client.ts`), which goes
  through `/api/proxy/*`. Server-only code lives in `src/lib/server/` and the `app/api/` route handlers.
- **New API areas** must be added to the proxy allowlist in `src/lib/server/proxy-paths.ts` (with a test).
- **No `NEXT_PUBLIC_` variables** for anything sensitive; `API_URL` is server-only.
- **Contracts come from `src/shared/`** (import from `@/shared`). It is a copy of `Fiducial_backend/src/shared`:
  never edit it here. Change the backend, then run `npm run shared:sync`.
- **Validate API responses** by passing the shared schema to `apiFetch({ schema })`.
- **Money and rates are strings.** Display them with the shared formatters (`formatAmount`, `formatRate`, Indian
  grouping); never parse them into floats or round rates to 2 decimals.
- **Accessibility**: label every input, keep visible focus, use `LoadingState` / `ErrorState` / `EmptyState` from
  `src/components/states.tsx`, and keep keyboard support for custom widgets.
- Imports: external packages first, then `@/` aliases, then relative paths. Use `import type` for types.

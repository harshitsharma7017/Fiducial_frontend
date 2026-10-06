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

## Frontend shell conventions

These apply to the code added by `.kiro/specs/frontend-shell` (see its design.md for details).

- **Adding a library needs the user's approval.** Approved for the shell: next-themes 0.4.6, Recharts 3.10.1 (with
  its `react-is` 19.3.0 peer), cmdk 1.1.1, fast-check 4.10.2 (dev) and @playwright/test 1.63.0 (dev, Chromium only).
  Check the exact version on npm before installing; if it does not resolve, ask instead of substituting another.
- **Never read the clock during render** (`react-hooks/purity`). Components use `useIstNow()`; data-layer functions
  may call `new Date()`.
- **Proposal data goes through hooks only.** Components call `useProposals`, `useProposal`, `useDashboardStats` and
  `useNotifications` from `src/lib/api/`. Sample data in `src/lib/data/` is imported only by `src/lib/api/` and tests.
  Swapping in the real API changes `src/lib/api/` and nothing else.
- **Proposal types live in `src/types/proposal.ts`** (constant arrays, labels, Zod schemas). They are not part of
  `src/shared` until the backend has a proposals API.
- **Proposal amounts are whole-rupee digit strings.** Add them with `sumRupees` (BigInt) and display them with
  `formatInr` or `formatInrCompact` from `src/lib/money.ts`. Only chart bar heights may use numbers.
- **Dates**: work out today, days to expiry and the current month in IST with `src/lib/dates.ts`; display with the
  shared `formatDate` (DD MMM YYYY).
- **Mock mode**: `USE_MOCK_API=true` makes the BFF sign in the demo users and never call the API. The code default is
  off; `.env.example` turns it on for local work. Browser code checks demo mode with `useDemoMode()` and
  `isDemoModeError()` from `src/lib/demo-mode.ts`, never in `src/shared`.
- **Property tests**: pure logic (money, dates, sample data, listing, URL state, mock mode, redirects) is checked
  against the Correctness Properties in the spec's design.md. Tag each test with
  `// Feature: frontend-shell, Property N: <name>`.
- **Components**: shadcn primitives in `src/components/ui`, layout pieces in `src/components/layout`, proposal pieces
  in `src/components/proposals`. Keep each file under about 250 lines; split instead.
- **URL state**: the dashboard's `?type=` and `?stage=` are read with `useUrlSearchParams` and written with
  `history.replaceState`.

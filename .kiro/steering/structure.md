# Structure (frontend)

```
src/
  app/
    layout.tsx, providers.tsx   root layout, React Query and toast providers
    login/                      sign-in page and form
    (app)/                      signed-in pages inside the app shell: dashboard, masters/occupancy,
                                masters/pincodes, rating/fire, users
    api/auth/login, logout      BFF: sets and clears the httpOnly session cookie
    api/proxy/[...path]         BFF: forwards allowlisted calls to the API with the bearer token
  components/
    app-shell/                  sidebar navigation (nav-items.ts), top bar, shell
    occupancy/, rating/, users/ feature components
    ui/                         shadcn-style primitives (Radix)
    states.tsx                  loading, empty, error and "master not active" states
  hooks/                        useCurrentUser, usePincode, useDebouncedValue, toast
  lib/
    api-client.ts               apiFetch() and ApiError (browser side)
    server/                     BFF helpers and the proxy allowlist (server only)
    session.ts, display.ts, query-keys.ts, utils.ts
  shared/                       copy of Fiducial_backend/src/shared (do not edit here)
  proxy.ts                      Next.js 16 proxy: redirects signed-out visitors to /login
scripts/sync-shared.mjs         shared:sync / shared:check
```

- A page is `page.tsx` (server component) plus a `*-view.tsx` client component next to it.
- Tests sit next to the code (`*.test.ts`, `*.test.tsx`).

## Added by the frontend-shell spec

`.kiro/specs/frontend-shell/` (requirements, design, tasks) changes the layout as follows once implemented:

```
src/
  app/(auth)/                   login and forgot-password with a shared two-column layout (moved from app/login)
  app/(app)/proposals/          list (?type=), new (placeholder), [id] (full proposal with tabs)
  app/(app)/settings, profile/  admin system status and master versions; account card
  components/layout/            app shell, sidebar, navbar, breadcrumbs, command palette, notifications,
                                user menu, theme toggle, nav-config.ts (replaces components/app-shell/)
  components/proposals/         type switch, pipeline strip, proposals table, drawer, tabs, badges, sections/
  lib/api/                      data-layer functions and TanStack Query hooks
  lib/data/                     sample data (imported only by lib/api and tests)
  lib/money.ts, lib/dates.ts    rupee arithmetic and formatting, IST date helpers
  lib/proposal-metrics.ts       table summaries, KPI inputs, expiry urgency, coverage columns and totals
  lib/proposal-params.ts        ?type= and ?stage= parsing and writing
  lib/demo-mode.ts              demo-mode error code and context (browser side)
  lib/server/mock-mode.ts       USE_MOCK_API demo users and mock tokens (server only)
  types/proposal.ts             proposal enums, labels, schemas and types
```

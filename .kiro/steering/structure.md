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

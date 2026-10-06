# Structure (frontend)

```
src/
  app/
    layout.tsx, providers.tsx   root layout, theme, React Query and toast providers
    (auth)/                     login and forgot-password with a shared two-column layout
    (app)/                      signed-in pages inside the app shell: dashboard, proposals (list, new, [id]),
                                masters/occupancy, masters/pincodes, masters/clients (list, [id]),
                                masters/insurers, masters/import, rating/fire, users, audit, settings, profile
    api/auth/login, logout      BFF: sets and clears the httpOnly session cookie
    api/proxy/[...path]         BFF: forwards allowlisted calls to the API with the bearer token
  components/
    layout/                     app shell, page gate, sidebar, navbar, breadcrumbs, command palette, notifications,
                                user menu, theme toggle; nav-config.ts holds the navigation and page permissions
    proposals/                  dashboard header, type switch, KPI cards, pipeline, chart, table, drawer, badges,
                                sections/ (shared by the drawer and the full proposal page)
    audit/                      audit log toolbar and entry row
    clients/                    client form sheet, address fieldset, details card, locations card and dialog
    insurers/                   insurer form sheet, RFQ emails field, activate / deactivate dialog
    imports/                    import panel (record type, template, file drop), record preview table, IIB master
                                result (report, save, activate), record types, upload hooks
    masters/                    download / upload actions and shared fields for the master forms
    occupancy/, pincodes/       occupancy detail and add/edit sheet; pincode add/edit dialog
    forms/                      contacts fieldset and pincode summary, shared by forms
    occupancy/, rating/, users/, settings/, profile/   feature components
    ui/                         shadcn-style primitives (Radix)
    states.tsx                  loading, empty, error, access denied, demo mode and "master not active" states
    demo-mode-gate.tsx          the demo-mode state in place of live-data pages in mock mode
  hooks/                        useCurrentUser, usePermission, useAuditLog, useDemoMode, useIstNow, usePincode, …
  lib/
    api-client.ts               apiFetch() and ApiError (browser side)
    api/                        proposal and notification data layer and its TanStack Query hooks
    data/                       sample data (imported only by lib/api and tests)
    form-errors.ts              puts the API's field errors (and codes such as GSTIN_TAKEN) on form fields
    client-query.ts             one client's query (key and fetch), shared by its page and breadcrumb
    audit-display.ts            audit filters in the URL, field labels and value formatting
    money.ts, dates.ts          rupee arithmetic and formatting, IST date helpers
    proposal-metrics.ts         table summaries, KPI inputs, expiry urgency, coverage columns and totals
    proposal-params.ts          ?type= and ?stage= parsing and writing
    use-url-search-params.ts    URL query state without navigation
    demo-mode.ts                demo-mode error code (browser side)
    server/                     BFF helpers, the proxy allowlist and mock mode (server only)
    session.ts, display.ts, query-keys.ts, utils.ts
  shared/                       copy of Fiducial_backend/src/shared, incl. roles, permissions and audit contracts
                                (do not edit here)
  types/proposal.ts             proposal enums, labels, schemas and types
  proxy.ts                      Next.js 16 proxy: redirects signed-out visitors to /login
scripts/sync-shared.mjs         shared:sync / shared:check
e2e/smoke.spec.ts               Playwright smoke test (playwright.config.ts builds and serves in mock mode)
```

- A page is `page.tsx` (server component) plus a `*-view.tsx` client component next to it.
- A new signed-in page gets a permission: a nav item with `permission`, or an entry in `OTHER_PAGES` in
  `nav-config.ts`. Pages with neither are open to every signed-in user.
- Tests sit next to the code (`*.test.ts`, `*.test.tsx`); the browser smoke test is in `e2e/` (`*.spec.ts`).

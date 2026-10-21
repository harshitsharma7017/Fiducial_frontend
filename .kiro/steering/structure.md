# Structure (frontend)

```
src/
  app/
    layout.tsx, providers.tsx   root layout, theme, React Query and toast providers
    (auth)/                     login and forgot-password with a shared two-column layout
    (app)/                      signed-in pages inside the app shell: dashboard, proposals (list, new, [id]), rfq,
                                masters/occupancy, masters/pincodes, masters/clients (list, [id]),
                                masters/insurers, masters/import, masters/templates, masters/family-plans (list, [id]),
                                masters/age-bands,
                                rating/fire, users, audit, ghi, eb/[product] (list, [id]),
                                settings, profile
    api/auth/login, logout      BFF: sets and clears the httpOnly session cookie
    api/proxy/[...path]         BFF: forwards allowlisted calls to the API with the bearer token
  components/
    layout/                     app shell, page gate, sidebar, navbar, breadcrumbs, command palette, notifications,
                                user menu, theme toggle; nav-config.ts holds the navigation and page permissions
    catalog/                    product and cover masters: generic table and row form from src/shared/catalog.ts
    email-templates/            email template editor (merge field buttons, live preview with renderMail())
    proposals/                  dashboard header, type switch, KPI cards, pipeline, chart, table, drawer, badges,
                                sections/ (shared by the drawer and the full proposal page), new-business/
                                (create form and the workspace: Data Sheet, activity), rfq/ (the Insurers and RFQ
                                tab: insurers card and rows, choose insurers, download, Email the RFQ with
                                previews and results, Sent outside the app, reminder and answer dialogs, mail log)
    claims/                     claims board (native drag-and-drop), table, detail sections, remark dialog,
                                new claim form, submission links, template editor and HR contacts, public page
    ghi/                        group health: workspace and tabs (Data Sheet, census and import, RFQ, quotes, QCR,
                                final QCR, payments, placement), line-of-business switch, new case form
    eb/                         GPA and GTLI: workspace and tabs (Data Sheet, census and import, RFQ, quotes, QCR,
                                client decision, payments, placement), product choice and new case chooser, plan
                                card and assign dialog, template download, member dialog, awaiting-confirmation notes
                                N4 to N7: age bands card, relationship rules editor, selection summary card
    age-bands/                  Age Band Master: set editor sheet (rules from the shared schema)
    family-plans/               Family Plan Master: version editor (rules from the shared schema), new plan sheet,
                                version card (activate, end date, client confirmation)
    audit/                      audit log toolbar and entry row
    clients/                    client form sheet, address fieldset, details card, locations card and dialog,
                                employees card and dialog (shared identity), default plans card
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
    api/                        proposal and notification data layer and its TanStack Query hooks;
                                new-business.ts reads proposals from the API and maps them onto the screen model
    data/                       sample data (imported only by lib/api and tests)
    eb/                         Employee Benefits queries (cases, census, quotes, plans, company employees) and the
                                fast-check property tests of the shared EB modules (*.property.test.ts)
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

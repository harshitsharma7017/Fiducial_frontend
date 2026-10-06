# Fiducial frontend

Next.js web app for the Property Insurance Placement ERP that Spirezen Enterprises is building for Fiducial. The ERP
will replace the Excel chain of Data Sheet → RFQ → insurer quotes → QCR → Placement Slip.

This repository holds the **foundation** screens: sign-in, a proposals dashboard with the detail drawer and full
page, occupancy and pincode masters, the Fire rate check, user admin and the audit log. Each role sees only the
screens and actions it is allowed ([Roles and permissions](#roles-and-permissions)). Light and dark themes follow the
system setting and can be switched by hand. The API lives in the separate **Fiducial_backend** repository. The browser
never calls it directly: this app's own server routes (a backend-for-frontend) hold the session and forward each
call.

The dashboard and proposal screens read **sample data**, not the API yet (see [Sample proposal data](#sample-proposal-data)).
To click through everything without running the backend, use [demo mode](#demo-mode-no-backend).

Project documents and open questions live in the backend repository: `docs/` and `docs/OPEN_ITEMS.md` there
(`../Fiducial_backend/docs` when the two repos are side by side).

## Prerequisites

- Node.js 24 LTS (`nvm use` reads `.nvmrc`) and npm 11
- Fiducial_backend running (http://localhost:4000 by default) with an admin seeded and the IIB master imported. Its
  README covers both.

## First run

```sh
nvm use
npm install
cp .env.example .env.local    # API_URL=http://localhost:4000
npm run dev                   # http://localhost:3000
```

Sign in with the admin you seeded in Fiducial_backend.

## Demo mode (no backend)

Set `USE_MOCK_API=true` in `.env.local` to run the whole app without Fiducial_backend. The sign-in route then
accepts five built-in demo users, one per role, and never calls the API; a "Demo mode" badge shows in the navbar.
`.env.example` ships with it on. Every demo user has the password `Fiducial-demo-2026`.

| Email                        | Role                     | Code              |
| ---------------------------- | ------------------------ | ----------------- |
| `demo.admin@example.com`     | Admin                    | `ADMIN`           |
| `demo.manager@example.com`   | Relationship Manager     | `ACCOUNT_MANAGER` |
| `demo.approver@example.com`  | Approver                 | `MANAGER`         |
| `demo.placement@example.com` | Underwriting / Placement | `PLACEMENT_EXEC`  |
| `demo.readonly@example.com`  | Read-only                | `READ_ONLY`       |

In demo mode the pages that read live data (Occupancy, Pincodes, Fire rate check, Users, Audit log and Settings) show
a short "Not available in demo mode" notice instead of calling the API. The dashboard and proposal screens work fully,
because they already use sample data. Turn demo mode off (`USE_MOCK_API=false` or unset) and the app signs in against
the real API again, unchanged.

## Roles and permissions

What each role may do is one table, `src/shared/permissions.ts`, shared with the API (the backend's README lists it).
The web app reads the same table:

| Screen or action                                                | Admin | Approver | Relationship Manager | Underwriting / Placement | Read-only |
| --------------------------------------------------------------- | ----- | -------- | -------------------- | ------------------------ | --------- |
| Dashboard, proposals, proposal drawer and page, masters lookups | yes   | yes      | yes                  | yes                      | yes       |
| Fire rate check                                                 | yes   | yes      | yes                  | yes                      |           |
| Document downloads (coming soon)                                | yes   | yes      | yes                  | yes                      |           |
| New proposal and Start renewal                                  | yes   |          | yes                  |                          |           |
| Users, Audit log, Settings                                      | yes   |          |                      |                          |           |

- Navigation shows only the items a user's permissions allow (`nav-config.ts`); a group with nothing left is hidden.
- Opening a page without its permission, for example by typing the URL, shows "You do not have access" inside the
  shell (`PageGate`), and the page sends no requests. Pages are mapped to permissions by `pagePermission()`.
- Actions use `usePermission()` or `can()`; components never compare role codes.
- The API checks the same permission on every route, so the screens are a convenience, not the security boundary.

The approve and send permissions exist for the RFQ, QCR and placement slip screens, which are not built yet. The
client still has to confirm the table (Q12 in the backend's `docs/OPEN_ITEMS.md`).

## Audit log

`/audit` (Admin) lists sign-ins and every create, edit and approval, newest first: when, who, what, which record, and
each changed field's old and new value (a new record shows its values). Filter by kind and record type; select a
person or a record in the list to narrow it to their entries or its history, and remove the filter from the chip.
The filters live in the URL, so the Users page links each user to `/audit?entity=user&entityId=<id>`. Send and export
entries arrive with RFQ email and document export. Entries are never changed or deleted.

## Sample proposal data

The dashboard, proposal lists, drawer, full proposal page, palette search and notifications read sample data built in
`src/lib/data/` (14 fictional proposals, with dates relative to today in IST). Components never import it: they call
the hooks in `src/lib/api/` (`useProposals`, `useProposal`, `useDashboardStats`, `useNotifications`). When the
proposals API exists, replace the bodies of the functions in `src/lib/api/proposals.ts` and `notifications.ts` with
`apiFetch()` calls, add `proposals` to the proxy allowlist, and delete `src/lib/data/`; no component changes.

## Scripts

| Command                       | Does                                                                     |
| ----------------------------- | ------------------------------------------------------------------------ |
| `npm run dev`                 | Next.js dev server on port 3000                                          |
| `npm run build` / `npm start` | Production build / serves it on port 3000                                |
| `npm run lint`                | ESLint (Next.js core web vitals, type-aware TypeScript) and Prettier     |
| `npm run typecheck`           | `next typegen` (route types), then `tsc --noEmit`                        |
| `npm test`                    | Vitest with Testing Library (jsdom)                                      |
| `npm run test:e2e`            | Playwright smoke test (Chromium): builds, starts in demo mode, signs in  |
| `npm run shared:check`        | Compares `src/shared` with the backend's copy; exits 1 if they differ    |
| `npm run shared:sync`         | Copies the backend's `src/shared` here (adds, updates and removes files) |
| `npm run format`              | Prettier write                                                           |

`npm run test:e2e` needs Playwright's Chromium once: `npx playwright install chromium`. It builds the app, serves it
on port 3100 with `USE_MOCK_API=true` (no API needed), signs in as the demo admin and checks the dashboard in light and
dark. CI runs it as its own job and caches the browser per Playwright version.

## Themes

The theme control in the navbar offers Light, Dark and System (the default, which follows the operating system). The
choice is kept in the browser (`localStorage`, key `erp-theme`) and applied before the first paint, so a reload never
flashes the other theme. Colours come only from the tokens in `src/app/globals.css`; `src/app/tokens.test.ts` checks
that every text and focus pair meets its contrast minimum in both themes.

## How it talks to the API

- `POST /api/auth/login` signs in against the API and keeps the access token in an httpOnly cookie (`erp_session`;
  `__Host-erp_session` in production), SameSite=Lax, that expires with the token. The browser receives only the user.
- `POST /api/auth/logout` tells the API (for the audit log) and clears the cookie, even if the API is unreachable.
- `/api/proxy/<path>` forwards to `/api/v1/<path>` with the token as a bearer header. Only `users`, `masters`,
  `rating`, `audit`, `health` and `auth/me` are allowed (`src/lib/server/proxy-paths.ts`). No cookie gives 401, a
  path outside the list gives 404, a cross-origin write gives 403, and a 401 from the API clears the cookie. The API
  then checks the user's permission for the route.
- `src/proxy.ts` (Next.js 16's replacement for middleware) sends signed-out visitors to `/login`.
- Client code calls `apiFetch()` (`src/lib/api-client.ts`). It parses responses with the shared Zod schemas and sends
  the user to sign-in on a 401.
- `API_URL` is read only on the server (`src/lib/server/bff.ts`). There are no `NEXT_PUBLIC_` variables.

## Shared contracts

`src/shared/` is an exact copy of `Fiducial_backend/src/shared/`: the request and response schemas, enums, types and
display formatters both repos use. Do not edit it here. Change the backend, then run:

```sh
npm run shared:sync    # reads ../Fiducial_backend; set FIDUCIAL_BACKEND_DIR to use another checkout
```

and commit the change in both repos. `npm run shared:check` lists any difference. CI runs it against the backend's
`main` branch (the `shared-contracts` job), so merge contract changes in the backend first. If Fiducial_backend
becomes private, give that job's backend checkout a read-only token.

## Layout

```
src/
  app/                  (auth)/ sign-in pages, (app)/ signed-in pages (dashboard, proposals, masters, rating,
                        users, audit, settings, profile), api/ (BFF route handlers)
  components/           layout/ (shell, navigation and page permissions), proposals/, audit/ and other feature
                        components; ui/ holds the shadcn-style primitives on Radix
  hooks/                React Query hooks (current user, permission, audit log) and small helpers
  lib/                  api-client, api/ (proposal data layer) and data/ (sample data), display helpers;
                        server/ is the BFF code (server only)
  shared/               copy of the backend's API contracts (do not edit here)
  types/proposal.ts     proposal enums, labels and schemas (until the backend has a proposals API)
  proxy.ts              redirects signed-out visitors to /login
scripts/sync-shared.mjs keeps src/shared identical to the backend's copy
```

## Conventions

- **Amounts and rates stay strings.** Never convert them to floats. Display them with the shared formatters: Indian
  digit grouping and 2 decimals for amounts; rates keep their full precision with at least 2 decimals (0.075 stays
  0.075).
- **Server state** goes through React Query (keys in `src/lib/query-keys.ts`); forms use React Hook Form with the
  shared Zod schemas.
- **UI**: shadcn-style components on Radix (`radix-ui`), Tailwind CSS 4 and lucide icons. Every input has a label;
  loading and error states use `role="status"` and `role="alert"` (`src/components/states.tsx`).
- **Planned features** show as disabled navigation items. Do not build screens for TBC client rules.

## Security notes

- The JWT is never readable by browser JavaScript: it sits in an httpOnly cookie and only this app's server adds it
  to API calls.
- State-changing BFF routes also check the `Origin` header, on top of SameSite=Lax.
- `next.config.ts` sets X-Frame-Options, X-Content-Type-Options, Referrer-Policy and Permissions-Policy. There is no
  Content-Security-Policy yet.
- Serve over HTTPS in production; the `__Host-` cookie requires it.
- The API rate-limits sign-ins per client IP, using the address this server forwards. Set `TRUST_PROXY` in the
  backend to match your deployment.

## Troubleshooting

- `npm install` fails with `EACCES` under `~/.npm`: the npm cache has root-owned files. Fix it once with
  `sudo chown -R "$(id -u):$(id -g)" ~/.npm`.
- "The server is not reachable" (502, `UPSTREAM_UNAVAILABLE`): the API is not running at `API_URL`.
- An error naming `API_URL`: `.env.local` is missing or the value is not a URL.
- "No master data is active yet": import and activate the IIB workbook in Fiducial_backend.

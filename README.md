# Fiducial frontend

Next.js web app for the Property Insurance Placement ERP that Spirezen Enterprises is building for Fiducial. The ERP
will replace the Excel chain of Data Sheet → RFQ → insurer quotes → QCR → Placement Slip.

This repository holds the **foundation** screens: sign-in, dashboard, occupancy and pincode masters, the Fire rate
check and user admin. The API lives in the separate **Fiducial_backend** repository. The browser never calls it
directly: this app's own server routes (a backend-for-frontend) hold the session and forward each call.

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

## Scripts

| Command                       | Does                                                                     |
| ----------------------------- | ------------------------------------------------------------------------ |
| `npm run dev`                 | Next.js dev server on port 3000                                          |
| `npm run build` / `npm start` | Production build / serves it on port 3000                                |
| `npm run lint`                | ESLint (Next.js core web vitals, type-aware TypeScript) and Prettier     |
| `npm run typecheck`           | `next typegen` (route types), then `tsc --noEmit`                        |
| `npm test`                    | Vitest with Testing Library (jsdom)                                      |
| `npm run shared:check`        | Compares `src/shared` with the backend's copy; exits 1 if they differ    |
| `npm run shared:sync`         | Copies the backend's `src/shared` here (adds, updates and removes files) |
| `npm run format`              | Prettier write                                                           |

## How it talks to the API

- `POST /api/auth/login` signs in against the API and keeps the access token in an httpOnly cookie (`erp_session`;
  `__Host-erp_session` in production), SameSite=Lax, that expires with the token. The browser receives only the user.
- `POST /api/auth/logout` tells the API (for the audit log) and clears the cookie, even if the API is unreachable.
- `/api/proxy/<path>` forwards to `/api/v1/<path>` with the token as a bearer header. Only `users`, `masters`,
  `rating`, `health` and `auth/me` are allowed (`src/lib/server/proxy-paths.ts`). No cookie gives 401, a path outside
  the list gives 404, a cross-origin write gives 403, and a 401 from the API clears the cookie.
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
  app/                  login/, (app)/ (dashboard, masters, rating, users), api/ (BFF route handlers)
  components/           app shell and feature components; ui/ holds the shadcn-style primitives on Radix
  hooks/                React Query hooks and small helpers
  lib/                  api-client, display helpers, session cookie; server/ is the BFF code (server only)
  shared/               copy of the backend's API contracts (do not edit here)
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

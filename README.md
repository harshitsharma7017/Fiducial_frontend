# Fiducial frontend

Next.js web app for **Fiducial**, the property insurance placement platform that Spirezen Enterprises is building for
Fiducial Insurance Brokers. It will replace the Excel chain of Data Sheet → RFQ → insurer quotes → QCR → Placement
Slip.

This repository holds the **foundation** screens: sign-in, a proposals dashboard with the detail drawer and full
page, occupancy and pincode masters, user admin and the audit log. Each role sees only the
screens and actions it is allowed ([Roles and permissions](#roles-and-permissions)). Light and dark themes follow the
system setting and can be switched by hand. The API lives in the separate **Fiducial_backend** repository. The browser
never calls it directly: this app's own server routes (a backend-for-frontend) hold the session and forward each
call.

New-business proposals are real: created, filled in and taken to the RFQ through the API (see
[New proposals to the RFQ](#new-proposals-to-the-rfq)), and so are renewals, which start from last year's policy.
Demo mode shows **sample data** (see [Sample proposal data](#sample-proposal-data)).
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

In demo mode the pages that read live data (Occupancy, Pincodes, Users, Audit log and Settings) show
a short "Not available in demo mode" notice instead of calling the API, as do Email templates, creating a proposal
and a real proposal's page (so no RFQ is emailed, reminded or logged in demo mode).
The sample cases show the insurer statuses, including Reminded and Overdue. The dashboard and proposal lists work fully on sample data, new business included. Turn demo mode off (`USE_MOCK_API=false` or unset) and the app signs in against
the real API again, unchanged.

## Roles and permissions

What each role may do is one table, `src/shared/permissions.ts`, shared with the API (the backend's README lists it).
The web app reads the same table:

| Screen or action                                                | Admin | Approver | Relationship Manager | Underwriting / Placement | Read-only |
| --------------------------------------------------------------- | ----- | -------- | -------------------- | ------------------------ | --------- |
| Dashboard, proposals, proposal drawer and page, masters lookups | yes   | yes      | yes                  | yes                      | yes       |
| Clients and risk locations, Insurers (view)                     | yes   | yes      | yes                  | yes                      | yes       |
| New client, edit client, add and edit risk locations            | yes   |          | yes                  |                          |           |
| Import data: clients and risk locations                         | yes   |          | yes                  |                          |           |
| Import data: insurers                                           | yes   |          |                      |                          |           |
| Add, edit and deactivate insurers                               | yes   |          |                      |                          |           |
| Document downloads (coming soon)                                | yes   | yes      | yes                  | yes                      |           |
| New proposal and Start renewal                                  | yes   |          | yes                  |                          |           |
| Users, Audit log, Settings                                      | yes   |          |                      |                          |           |
| EB lists and cases (GMC, GPA, GTLI), company employees          | yes   | yes      | yes                  | yes                      | yes       |
| New Employee Benefits case                                      | yes   |          | yes                  |                          |           |
| EB case edits, census, payments, placement, employees           | yes   |          | yes                  | yes                      |           |
| EB RFQ and QCR approval                                         | yes   | yes      |                      |                          |           |
| Family plans and company default plans (view)                   | yes   | yes      | yes                  | yes                      | yes       |
| Family plans: create, edit, activate, confirm, deactivate       | yes   |          |                      |                          |           |
| Company default plans (change)                                  | yes   |          | yes                  |                          |           |
| Age bands (view)                                                | yes   | yes      | yes                  | yes                      | yes       |
| Age bands: create, edit, activate, deactivate                   | yes   |          |                      |                          |           |
| Choose a case's age bands                                       | yes   |          | yes                  | yes                      |           |
| RFQ selection summary (view)                                    | yes   | yes      | yes                  | yes                      | yes       |
| RFQ selection summary download                                  | yes   | yes      | yes                  | yes                      |           |

- Navigation shows only the items a user's permissions allow (`nav-config.ts`); a group with nothing left is hidden.
- Opening a page without its permission, for example by typing the URL, shows "You do not have access" inside the
  shell (`PageGate`), and the page sends no requests. Pages are mapped to permissions by `pagePermission()`.
- Actions use `usePermission()` or `can()`; components never compare role codes.
- The API checks the same permission on every route, so the screens are a convenience, not the security boundary.

Emailing the RFQ, reminding an insurer and marking it sent need `proposals.send`; recording an insurer's answer,
`proposals.edit`; downloading the RFQ or a mail's attachment, `proposals.export`; editing email templates,
`masters.manage`. The approve permission waits for the
QCR and placement slip screens, which are not built yet. The
client still has to confirm the table (Q12 in the backend's `docs/OPEN_ITEMS.md`).

## Clients and insurers

- `/masters/clients` lists clients by name; search by name or the start of the GSTIN. **New client** opens a side
  sheet: insured name, GSTIN (checked as you type for format, state code and check character, and named by its
  state when valid), nature of business, occupancy (from the active master), communication address and contacts. A
  GSTIN that belongs to another client is shown on the GSTIN field.
- `/masters/clients/{id}` shows the client and its risk locations, with **Edit client**, **Add location** and
  **Edit** per location. A location's pincode fills its state, district and earthquake zone from the pincode master;
  a location has the client's occupancy unless one is chosen for it.
- `/masters/insurers` lists insurer branches with their RFQ email addresses and contacts, active ones first by
  default. Admins add, edit, deactivate and reactivate them.
- `/masters/import` (**Import data**) loads the IIB master (Admin), clients, risk locations and insurers from Excel. The
  IIB master previews its validation report, saves as a draft version and is then activated; the Occupancy and
  Pincodes pages have **Download as Excel** (to edit and re-upload) and **Upload new version**. Admins also add and
  edit single rows there: **Add occupancy** and **Edit** in an occupancy's details, **Add pincode** and **Edit** in the
  pincode list (searchable by pincode, district or state). Records: Pick the record type
  (only the ones your permissions allow), download its template (a sample file is linked in the hints), then drop
  or browse for the filled-in .xlsx and **Preview**. The preview lists every row as Valid or Invalid with its
  problems (field — reason); valid rows start ticked and rows with problems cannot be ticked. **Import N** saves
  the ticked rows and leaves the rest out. Import clients before their risk locations.
- These pages read live data, so they show the demo-mode state in mock mode.

## Policy and cover masters

Masters → Policies, Coverage sections, Add-on Covers, Tax rates and Standard notes (M-4 to M-9). Every role can view
them; Admins (`masters.manage`) edit rows on screen, move policies, sections and notes up or down, and replace the
masters from Excel.

- **Excel**: "Download as Excel" gives one workbook with a sheet per master. Upload it on Import data → "Policy and
  cover masters": the preview checks every sheet, and "Replace" saves each sheet in the file as the whole of its
  master once everything passes.
- **Screens** are one generic table and form (`components/catalog/`) built from the column definitions in
  `src/shared/catalog.ts`; the form runs the same checks as the upload before saving.
- **Policies** has "Try a sum insured" to see which policies a range suggests. (Screens say "policy"; the
  code, API paths and `/masters/products` URL keep the name product.) A proposal shows its suggestion under
  its header. **Coverage sections** sets the Data Sheet's and RFQ's section order and names; Fire stays first.
  **Add-on Covers** has the four lists (filter and search) and a "BSUS & BLUS limits and rates" tab. **Tax rates**
  marks the rate in force today; a proposal keeps the rate it was created with.

## Document templates

Masters → Document templates (`/masters/templates`, R-3 and R-4) holds the client's Excel templates, one each for the
RFQ, QCR and Placement Slip. Every role can see and download them; Admins upload or replace one with the button on
its card. An RFQ template is checked before it is kept: the card lists its sheets and whether the logo and the broker's
address were found, or the problems that stopped it. Once it is uploaded, Download RFQ fills that file (Excel) or
draws it on A4 with the letterhead (PDF); until then the built-in layout is used, and the RFQ tab says which.
QCR and Placement Slip templates are stored only, until those documents are built.

## Email templates

Masters → Email templates (`/masters/email-templates`, E-2): the subject and message of the RFQ and reminder mails.
Every role with `masters.view` can read them; Admins edit them. The merge field buttons put `{{insuredName}}`,
`{{policyPeriod}}`, `{{dueDate}}`, `{{reference}}`, `{{insurerName}}`, `{{contactName}}` or `{{senderName}}` in at the
cursor; an unknown field or a stray `{{` is flagged as you type and again by the API. The preview uses the shared
`renderMail()`, the function the API sends with, on sample values or a recent case. "Default" marks wording that has
not been edited; saving sends the version loaded, and if someone saved meanwhile the card says so and offers to
reload.

## Audit log

`/audit` (Admin) lists sign-ins and every create, edit and approval, newest first: when, who, what, which record, and
each changed field's old and new value (a new record shows its values). Filter by kind and record type; select a
person or a record in the list to narrow it to their entries or its history, and remove the filter from the chip.
The filters live in the URL, so the Users page links each user to `/audit?entity=user&entityId=<id>`. Send and export
entries come from the RFQ (download and marking it sent). Entries are never changed or deleted.

## New proposals to the RFQ

- **Create** (`/proposals/new?type=new`, or `?type=existing` from Start renewal; `proposals.create`): New business
  or Renewal, the insured from the client master, its risk locations, the policy period (the end follows the start:
  a year less a day), who it is assigned to, and the date quotes are needed by. For a renewal, last year's policy is
  fetched from the policy software and shown first, and the new period starts the day after it ends.
- **Stages**: 9 on every case (the stepper, dashboard chips and chart). After the RFQ is sent, "Move to …" takes the
  case to its next stage; "Close case" (with a reason) ends it.
- **Renewals** show the Existing policy card (with Fetch again) and an Existing column in the Fire lines and other
  sections.
- **Delete** (Admins, `proposals.delete`): a bin icon on each row of Proposals, RFQ, Quotes and QCR and Placement
  Slips asks, then moves the case to the Deleted bin (`components/proposals/delete-case.tsx`). **Proposals → Deleted
  bin** (`/proposals/deleted`) lists binned cases with who deleted them and when, and restores them as they were.
- **Workspace** (`/proposals/{id}` for an id from the API; sample ids keep the read-only page):
  - **Data Sheet**: dates; per location the Fire & Burglary block laid out as the client's Data Sheet (7 numbered
    items with sub-items, sq ft × rate for buildings, heading subtotals and a running total), hypothecation and stock
    kept at open space, and the nine risk details; add or remove the client's locations; Fire Option 2
    per line; the 13 other sections (include or not required, Proposed 1 and 2, the Data Sheet's lines for FLOP, Money, Fidelity
    and Public Liability, which give the sum insured once entered: gross profit, safe + single carrying, limit per
    policy period, aggregate limit; and add-row annexure grids for Plate Glass, Neon Sign, All Risk, EEI, MBD and
    Boiler whose total is the section's sum insured); up to three years of claims; notes. Saved as a
    whole. **Import from Excel** reads the client's Data Sheet workbook through the API and fills the form as unsaved
    changes (a dialog asks which location each sheet fills when it is not clear), to be checked and saved
    (`data-sheet-import.tsx`, `src/lib/data-sheet-import.ts`); a workbook chosen on the New proposal screen is read
    the same way once the case opens. The checklist of what is still needed comes from the API. Totals update as you type
    (`src/lib/data-sheet.ts`: exact paise in BigInt, shown to the rupee, as Excel does), and the API's figures replace
    them on save. The Burglary row offers the contents total (all Fire items except buildings).
  - **Case options** (C-1 to C-6, `product-addons.tsx`, `section-details.tsx`): the Product card follows the Fire
    sum insured as you type and asks for a reason when another product is chosen; its add-on picker lists the
    product's add-ons with search, a star per add-on for the client's favourites (listed first) and chips for the
    chosen ones. Fire lines, sections and section lines have Existing (renewals, editable), Option 1 and Option 2.
    Burglary has a basis (100% or first loss 25/50/75%) and then follows the Fire contents. Each section's add-on
    covers have Required / Not required toggles.
  - **Insurers and RFQ** (`components/proposals/rfq/`): up to five active insurers, Download RFQ (Excel or PDF)
    once the Data Sheet is complete, and **Email the RFQ**: each Not sent insurer with its RFQ addresses ticked and
    its contacts unticked (no typed addresses), the quote due date and the attachment format, a preview of each
    insurer's mail from the API, then one mail per insurer. The results list each insurer, with the reason and
    **Try again** (a new send id) for a failure. **Sent outside the app** records an RFQ sent another way, with its
    due date. Each insurer shows its status (Not sent, Sent, Reminded, Quoted, Declined, No response), Overdue after
    its due date, when and by whom it was sent, its reminders and its answer's note; **Remind** (Sent or Reminded,
    starting with the last mail's addresses, the RFQ attached again unless unticked) and **Record answer** (only the
    changes `canMoveInsurer()` allows). The first insurer sent locks the Data Sheet. When the API has mail turned off
    (a 409 `MAIL_DISABLED`, or Settings' mail card for Admins), the tab falls back to copying the addresses and
    marking the RFQ sent.
  - **RFQ review** (R-1, R-2, R-5, `components/proposals/rfq-review/`): the RFQ previewed from the case (premium
    details, schedule, risk details, claims, annexure); on the draft the heading, notes for insurers, risk details and
    claims are edited in place (marked Edited, with a way back to the Data Sheet's value) and saved. Generate v1, v2…
    keeps each version; the preview can show any version, with its Excel and PDF. Submit for approval; an approver
    approves or returns it with comments; the history lists every step. The Insurers and RFQ tab sends only once
    the latest version is approved and current.
  - **Quotes** (Q-1 to Q-5, `components/proposals/quotes/`): per insurer and option, the latest quote with net, GST
    and total (with and without terrorism), its deviations from the RFQ and the insurer's mail or PDF; earlier
    versions under "Earlier versions"; a declined insurer with its reason; and "For the QCR", the latest version of
    each quote from insurers that have not declined. "Enter quote" / "Revise quote" opens the entry sheet: premiums
    of the sections asked for with live totals, the add-ons and covers asked for (Accepted / Declined), deductibles,
    capacity, conditions, validity, the proof (upload or pick one already kept; required) and, for a revision, its
    reason. Declining an insurer (Record answer → Declined) needs the reason.
  - **QCR** (QC-1 to QC-6, `components/proposals/qcr/`): the comparison per option (existing policy and every
    insurer's latest quote, Fire without terrorism, net / GST / total, Lowest and Recommended badges, deviations and
    "Where the insurers differ"); the recommendation, remarks and "cheque / payment in favour of"; Approve QCR (for
    `proposals.approve`, once nothing is missing and changes are saved); Download QCR (Excel or PDF); and Send to the
    insured (client contacts or other addresses, PDF or Excel), offered only while the approval is current.
  - **Activity**: the mails of the case (kind, insurer, To, who, when, Delivered, Outbox or Failed; select one for its
    subject, message and attachment), then the proposal's history, newest first. `?tab=data-sheet|review|rfq|quotes|qcr|activity` opens
    a given tab.
- **RFQ page** (`/rfq`, sidebar Workflow → RFQ, `proposals.view`): every new-business RFQ, ready to send first, with
  status chips (Data Sheet incomplete, Ready to send, Partly sent, Sent; `?status=`), an Overdue responses chip
  (`?filter=overdue`, linked from the dashboard), search by reference, client or insurer (`?q=`), each insurer's
  status, the due date and the last send. An insurer counts as sent once it has the RFQ, whatever it answered. A reference opens the proposal on the
  tab that needs work. Statuses come from `src/lib/rfq-status.ts`.
- **Dashboard**: Awaiting quotes counts insurers that are Sent or Reminded on open cases; Overdue responses counts
  those past their due date and links to the RFQ page. The table's Insurers column (responded out of listed) has a
  tooltip with the count per status.
- Cases from the API appear on the dashboard, in the lists, drawer and palette: `src/lib/api/new-business.ts` maps each
  one onto the screen model (product and add-ons are chosen at the QCR; a renewal's Existing figures and expiry come
  from last year's policy).

## Employee Benefits (GMC, GPA, GTLI)

- **Navigation**: the Employee Benefits group lists GMC (Group Health) `/ghi`, GPA (Personal Accident) `/eb/gpa` and
  GTLI (Term Life) `/eb/gtli`; Masters has Family plans. New proposal asks Property or Employee Benefits, then the
  product, with nothing chosen at first (`?line=eb&product=GPA` preselects).
- **GPA and GTLI cases** (`/eb/{product}/{id}`, `components/eb/eb-workspace.tsx`): Data Sheet (validated by the
  shared schema before saving), family plan card, census with the provisional template download, import (mode,
  policy chosen explicitly, row corrections, error report) and members by hand, RFQ, quotes (GST and totals from the
  API), QCR with approval, the client's decision (sent with the QCR fingerprint), payments and the placement slip.
  The API calls go through the proxy to `/api/v1/eb/{gpa,gtli}/cases/...`.
- **Family Plan Master** (`/masters/family-plans`): plans by product with the version in effect and its client
  confirmation; a plan's page edits Draft versions with every rule of `PlanVersionInputSchema` shown on its field as
  the user types (nothing is sent while a problem shows), activates them, sets an end date once, records the
  client's confirmation, and deactivates the plan after listing the open cases that use it. Changes need
  `masters.manage`.
- **Company page** (`/masters/clients/{id}`): the employees shared by the company's GMC, GPA and GTLI cases (50 a
  page, unresolved first; update or resolve with a reason, `proposals.edit`) and the default plan per product
  (`clients.manage`).
- **Templates**: the seven census templates are provisional (no client format received); every download says so.

## Age bands, GPA rules, GTLI sum assured and the RFQ selection summary (N4 to N7)

- **Masters → Age bands** (`/masters/age-bands`, `components/age-bands/`): named sets of bands edited with every rule
  shown on its field as the user types; the cases using a set are listed. Option 2 is defined by an Admin (open
  question AB-1).
- **Case**: an Age bands card on the census tab chooses the case's set (a copy; a newer revision is flagged). The
  census summary and the RFQ follow it.
- **GPA Data Sheet**: dependants' cover by relationship (percentage, fixed amount, the employee's, or own), with a
  button that fills the client's example (spouse 50%, child ₹50,000) as editable sample values; who needs a nominee.
- **GTLI / GPA salary**: the census gives the annual or the monthly salary; members show how their cover is worked out
  (for example "₹50,000 a month × 12 = ₹6,00,000 annual CTC × 4 = ₹24,00,000").
- **Members**: monthly salary and the nominee in the member dialog; the members table shows each cover's basis.
- **RFQ tab**: the RFQ selection summary (employees and lives by cover, the age band matrix, gender and relationship
  counts, cover by relationship) with Excel and PDF downloads, or as kept on an RFQ version.

## Sample proposal data

In demo mode only, the dashboard, proposal lists, drawer, full proposal page, palette search and notifications read
sample data built in `src/lib/data/` (14 fictional proposals, with dates relative to today in IST; they use the
original six stages). Components never import it: they call the hooks in `src/lib/api/` (`useProposals`,
`useProposal`, `useDashboardStats`, `useNotifications`). `proposalsOf()` in `src/lib/api/proposals.ts` reads the API
(`fetchCases`) and falls back to the samples in demo mode.

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
  `audit`, `health` and `auth/me` are allowed (`src/lib/server/proxy-paths.ts`). No cookie gives 401, a
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
  app/                  (auth)/ sign-in pages, (app)/ signed-in pages (dashboard, proposals, masters,
                        users, audit, settings, profile), api/ (BFF route handlers)
  components/           layout/ (shell, navigation and page permissions), proposals/, audit/ and other feature
                        components; ui/ holds the shadcn-style primitives on Radix
  hooks/                React Query hooks (current user, permission, audit log) and small helpers
  lib/                  api-client, api/ (proposal data layer) and data/ (sample data), display helpers;
                        server/ is the BFF code (server only)
  shared/               copy of the backend's API contracts (do not edit here)
  types/proposal.ts     the screens' proposal model (new business from the API is mapped onto it)
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
- "No master data is active yet": as an Admin, upload the IIB workbook on **Masters › Import data** (record type
  IIB master), then **Save as new version** and **Activate**.

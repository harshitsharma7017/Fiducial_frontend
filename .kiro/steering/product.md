# Product

Property Insurance Placement ERP for **Fiducial**, an insurance broker, built by Spirezen Enterprises. It replaces an
Excel chain: Data Sheet → RFQ → insurer quotes → QCR (quote comparison report) → Placement Slip. A risk is entered
once, rated from versioned master data, sent to insurers, compared and placed, with an audit trail.

Two repositories: **Fiducial_frontend** (this one: Next.js web app and its server-side BFF routes) and
**Fiducial_backend** (Express API, MongoDB, master data, rating). Source documents (01 PRD to 07 format analysis) and
`OPEN_ITEMS.md` are in the backend's `docs/`.

## Users and roles

| Role              | Who                                                              |
| ----------------- | ---------------------------------------------------------------- |
| `ADMIN`           | Operations / admin: users, master data. Passes every role check. |
| `MANAGER`         | Reviews and approves RFQs and placements                         |
| `ACCOUNT_MANAGER` | Owns the client; creates risks, reviews the QCR                  |
| `PLACEMENT_EXEC`  | Prepares RFQs, chases and enters insurer quotes                  |
| `READ_ONLY`       | Views only                                                       |

## Domain terms

- **IIB master**: occupancy rate master. Each **TAC code** (text, for example `1001_2`) has a risk grade (RG1 to
  RG9), an IIB rate, a Fire risk type, a Terrorism risk type, a minimum STFI rate and minimum EQ rates for Zone I to IV.
- **Pincode master**: pincode → state, district, AIFT earthquake zone (1 to 4) and EQ rates by risk type. Zone 1 is
  "Zone I", the highest EQ rates.
- **Risk types**: `RESIDENTIAL`, `NON_INDUSTRIAL` (the sheet writes "N Industrial"), `INDUSTRIAL`.
- **Per mille (‰)**: all rates are per thousand of sum insured. Premium = sum insured × rate / 1000.
- **STFI**: storm, tempest, flood, inundation. **EQ**: earthquake. **SI**: sum insured.
- **Master version**: each import is a `DRAFT`; an admin activates it (`ACTIVE`); the previous one becomes
  `SUPERSEDED`. Lookups and ratings always read the ACTIVE version.

## Current phase: foundation

Built: sign-in, app shell with role-aware navigation, dashboard (system status, active master versions), occupancy
and pincode lookups, the Fire rate check with its breakdown, and user admin.

Not built yet (shown as disabled navigation items): clients, risks, Data Sheet, RFQ, quotes, QCR, placement slips.

## Rules

- Do not invent client business rules. Anything TBC stays unbuilt and is listed in the backend's `docs/OPEN_ITEMS.md`.
- The API does every calculation. The UI displays the values it returns and never recomputes premiums.

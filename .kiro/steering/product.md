# Product

**Fiducial**: the property insurance placement platform for Fiducial Insurance Brokers, built by Spirezen
Enterprises. The product is called Fiducial everywhere it is shown (not "Property ERP"). It replaces an
Excel chain: Data Sheet → RFQ → insurer quotes → QCR (quote comparison report) → Placement Slip. A risk is entered
once, rated from versioned master data, sent to insurers, compared and placed, with an audit trail.

Two repositories: **Fiducial_frontend** (this one: Next.js web app and its server-side BFF routes) and
**Fiducial_backend** (Express API, MongoDB, master data, rating). Source documents (01 PRD to 07 format analysis) and
`OPEN_ITEMS.md` are in the backend's `docs/`.

## Users and roles

| Role code         | Label                    | Who                                                             |
| ----------------- | ------------------------ | --------------------------------------------------------------- |
| `ADMIN`           | Admin                    | Operations / admin: users, master data. Holds every permission. |
| `MANAGER`         | Approver                 | Reviews and approves RFQs and placements                        |
| `ACCOUNT_MANAGER` | Relationship Manager     | Owns the client; creates risks, sends RFQs, reviews the QCR     |
| `PLACEMENT_EXEC`  | Underwriting / Placement | Prepares RFQs, chases and enters insurer quotes                 |
| `READ_ONLY`       | Read-only                | Views only                                                      |

What each role may do is the table in `src/shared/permissions.ts` (copied from the backend; the README shows it per
screen). It follows the PRD personas and waits for the client's confirmation (Q12).

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

## Proposals

- **Proposal**: one placement for one client. **New proposal** (`NEW`): new business, started from a Data Sheet, no
  existing policy. **Existing proposal** (`EXISTING`, renewal): the RFQ and QCR compare the existing policy with two
  proposed options.
- **Stages**: Draft → Data Sheet → RFQ Sent → Quotes Received → QCR → Placed. (The SRS lists a different status
  workflow; the client has not settled it.)
- **Products by sum insured**: BSUS up to ₹5 Cr, BLUS above ₹5 Cr up to ₹50 Cr, SFSP above ₹50 Cr, PAR optional above
  ₹5 Cr. Whether the test uses total or per-location sum insured is open (Q04); the UI never selects a product.
- **14 coverage sections**, in this order: Fire, Burglary, Fire Floater, Burglary Floater, Fire Loss of Profit, Money,
  Fidelity Guarantee, Plate Glass, Neon / Glow Sign, All Risk, EEI, Mechanical Breakdown, Boiler and Pressure Plant,
  Public Liability.
- **Sum-insured options**: Existing (renewals only), Proposed 1, Proposed 2. A new proposal never shows Existing.
- **Quote status** per insurer (up to 5): Not sent, Sent, Quoted, Declined, No response.
- **Documents**: Data Sheet, RFQ, QCR, Placement Slip, each Not started, Draft, Ready, Sent or Approved.
- **Add-on catalogues** (client's RFQ workbook): BSUS and BLUS 20 entries, PAR 125, SFSP 185.

## Current phase

Built (foundation): sign-in, occupancy and pincode lookups, the Fire rate check with its breakdown, user admin,
settings (system status, active master versions), screens and actions per role (F-2), and the audit log page with
who, when and old and new values (F-3).

Built from the frontend-shell spec (`.kiro/specs/frontend-shell`; its wrap-up tasks 6.x are still open): themes, the
new layout, mock API mode with one demo user per role, and a proposals dashboard, drawer and full page on sample
data.

Built (masters M-1 to M-3): the client master with GSTIN validation and duplicate blocking, any number of risk
locations per client, and the insurer master with RFQ email addresses (`/masters/clients`, `/masters/insurers`), with
Excel templates and a preview-then-import of chosen valid rows for all three (`/masters/import`).

Built (new business to the RFQ): create a proposal from the client master, the Data Sheet, choosing up to five
insurers, the RFQ workbook download and marking it sent, which locks the Data Sheet (`/proposals/new?type=new`,
`/proposals/{id}`; `components/proposals/new-business/`), and the RFQ page listing every RFQ by status (`/rfq`).

Built (M-4 to M-9): product and cover master screens (`/masters/products`, `/sections`, `/addons`, `/tax-rates`,
`/notes`; `components/catalog/`) and their Excel upload on Import data.

Not built yet: starting a renewal, quotes, QCR and placement slip screens, and the API for renewals.

## Rules

- Do not invent client business rules. Anything TBC stays unbuilt and is listed in the backend's `docs/OPEN_ITEMS.md`.
- The API does every calculation. The UI displays the values it returns and never recomputes premiums. The Data
  Sheet's running totals are a typing preview with the API's own arithmetic; the saved figures come from the API.
- Renewals run on sample data until the API serves them, and say so on screen. Sample company, person and
  insurer names are fictional.

# Requirements: frontend shell

## Introduction

This spec covers the frontend shell of the Property Insurance Placement ERP in **Fiducial_frontend** (the brief's
`apps/web`). It includes sign-in, the signed-in layout with a sidebar and top navbar, light and dark themes, and a
dashboard of new and existing (renewal) proposals with their components.

The work is UI only. Proposal data is typed sample data behind a data layer (`src/lib/api`) that can later call the
real API without changes to components. The existing backend-for-frontend (BFF) routes and the masters, rating and
user pages keep working.

Out of scope: a real proposals API, proposal create or edit forms, RFQ, QCR and placement slip screens, document
generation, email, internationalisation and real notifications.

Sources: the frontend-shell brief (5 Oct 2026); documents 01, 02, 06 and 07 in `Fiducial_backend/docs`; the client's
RFQ workbook in `Fiducial_backend/data/client-formats`. Decisions and open questions are in [design.md](design.md).

## Glossary

| Term                        | Meaning                                                                                                                                                                                                                                       |
| --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Proposal                    | One insurance placement for one client.                                                                                                                                                                                                       |
| New proposal                | New business, started from a Data Sheet. There is no existing policy. Type `NEW`.                                                                                                                                                             |
| Existing proposal (renewal) | Has an existing policy. The RFQ and QCR compare it with two proposed sum-insured options. Type `EXISTING`.                                                                                                                                    |
| Stage                       | Draft → Data Sheet → RFQ Sent → Quotes Received → QCR → Placed.                                                                                                                                                                               |
| Product                     | BSUS (sum insured up to ₹5 Cr), BLUS (above ₹5 Cr up to ₹50 Cr), SFSP (above ₹50 Cr), PAR (optional, above ₹5 Cr).                                                                                                                            |
| Coverage section            | One of 14, in this order: Fire, Burglary, Fire Floater, Burglary Floater, Fire Loss of Profit, Money, Fidelity Guarantee, Plate Glass, Neon / Glow Sign, All Risk, EEI, Mechanical Breakdown, Boiler and Pressure Plant, Public Liability.    |
| Sum-insured option          | Existing (renewals only), Proposed 1, Proposed 2.                                                                                                                                                                                             |
| Fire SI (Proposed 1)        | The Fire section's sum insured under Proposed 1: the headline figure in the table, the KPI cards and the chart (design.md Q4). Whether the product test uses total or per-location sum insured is an open client question (document 06, Q04). |
| Quote status                | Not sent, Sent, Quoted, Declined, No response. "Responded" means Quoted or Declined.                                                                                                                                                          |
| Document status             | Not started, Draft, Ready, Sent, Approved, for each of Data Sheet, RFQ, QCR and Placement Slip.                                                                                                                                               |
| Days to expiry              | Calendar days from today to the existing policy's expiry date, in India Standard Time (IST).                                                                                                                                                  |
| Mock API mode               | `USE_MOCK_API=true`: the BFF signs in demo users without calling Fiducial_backend.                                                                                                                                                            |
| Sample data                 | The typed mock proposals and notifications in `src/lib/data`, used in both modes until a proposals API exists.                                                                                                                                |

## Requirements

### Requirement 1: Themes

**User story:** As a team member who works long sessions, I want light, dark and system themes, so that the app stays
comfortable and readable in any lighting.

#### Acceptance criteria

1. The app SHALL offer three theme options, Light, Dark and System, and SHALL use System until the user chooses.
2. WHEN the user chooses a theme THEN the app SHALL apply it at once by adding or removing the `dark` class on the
   `<html>` element, and SHALL keep the choice in that browser across reloads and sign-outs.
3. WHILE System is selected the app SHALL follow the operating system's colour scheme, including a change made while
   the app is open.
4. WHEN any page loads or reloads THEN the app SHALL paint it in the stored or system theme from the first frame, with
   no flash of the other theme.
5. The app SHALL show a theme control (a menu with Light, Dark and System, with the current choice marked) in the top
   navbar and on the sign-in and forgot-password pages.
6. The app SHALL render every surface correctly in both themes: pages, cards, tables, badges, chips, drawers, dialogs,
   menus, tooltips, skeletons, toasts and the chart.

### Requirement 2: Design tokens and contrast

**User story:** As a team member, I want a calm, dense but readable interface with enough contrast, so that I can
scan data quickly without strain.

#### Acceptance criteria

1. The app SHALL define every colour as a CSS variable in the shadcn convention, with a light and a dark value, mapped
   into the Tailwind theme. This covers background, card, popover, border, input, ring, foreground, muted, primary,
   accent, success, warning, destructive (danger), info, chart and sidebar tokens.
2. The app SHALL use the brief's values for background, card, border, foreground, muted foreground, primary and
   accent in both themes. design.md lists every token.
3. Component and page code SHALL use colours only through token utilities. No hex, rgb or hsl colour literal SHALL
   appear outside `globals.css`.
4. The app SHALL meet WCAG 2.2 AA contrast in both themes: at least 4.5:1 for text, including badges, chips and table
   text, and at least 3:1 for focus indicators, form field borders and chart bars against their backgrounds.
5. The app SHALL use the system font stack, and tabular numerals for every amount, count and date in tables, cards
   and the chart.
6. The app SHALL NOT use gradients, glass effects, large illustrations or decorative animation.
7. WHERE the operating system asks for reduced motion the app SHALL turn off transitions and animations, including
   the drawer slide, the sidebar resize and the skeleton pulse.

### Requirement 3: Sign-in page

**User story:** As a team member, I want a clear sign-in page, so that I can get into the ERP quickly and understand
any problem.

#### Acceptance criteria

1. WHILE the screen is 1024 px wide or more the sign-in page (`/login`) SHALL show a left panel and the sign-in form on
   the right. The left panel has the product name "Property Insurance Placement ERP", a one-line description and
   three value points (one risk entry, consistent rating, full audit trail). WHILE the screen is narrower it SHALL
   show only the form.
2. The form SHALL have an email field and a password field. The password field has a show/hide button whose
   accessible name states its action ("Show password" or "Hide password") and which keeps focus where it is.
3. WHEN the user submits with an invalid email or an empty password THEN the form SHALL show the error under the
   field, link it with `aria-describedby`, set `aria-invalid` and focus the first invalid field, without calling the
   server.
4. WHEN the user presses Enter in a field THEN the form SHALL submit.
5. WHILE a sign-in request is in progress the form SHALL disable the submit button and show a spinner with the text
   "Signing in…".
6. IF the credentials are wrong THEN the form SHALL show a clear failure message in an alert, clear the password and
   focus the password field.
7. IF the server cannot be reached, rate-limits the request or returns another error THEN the form SHALL show a
   message specific to that case.
8. WHEN sign-in succeeds THEN the app SHALL open the page in the `next` query parameter if it is a same-site path, and
   `/dashboard` otherwise. A value with a backslash, a control character or a leading "//", or one that the URL
   parser resolves to another origin, is not a same-site path.
9. The sign-in page SHALL show a visible "Forgot password?" link to `/forgot-password`. That page is a placeholder
   that says self-service reset is not available yet and links back to sign-in.

### Requirement 4: Session handling through the BFF

**User story:** As the system owner, I want the session token kept away from browser scripts, so that a script
injected into the page can never read it.

#### Acceptance criteria

1. WHEN sign-in succeeds THEN `POST /api/auth/login` SHALL set the session cookie as httpOnly, SameSite=Lax, path
   `/`, Secure in production and lasting as long as the token, and SHALL return only the user to the browser.
2. WHEN the user signs out THEN `POST /api/auth/logout` SHALL clear the session cookie, telling the API first when mock
   mode is off, and the app SHALL load `/login`.
3. WHEN a visitor without a session cookie requests a page other than `/login` and `/forgot-password` THEN
   `src/proxy.ts` SHALL redirect to `/login` with the requested path in `next`.
4. WHEN a visitor with a session cookie requests `/login` THEN `src/proxy.ts` SHALL redirect to `/dashboard`.
5. IF a request to `/api/proxy/*` has no session cookie THEN the BFF SHALL answer 401 without contacting the API.
6. The session token SHALL NOT appear in any response body, in browser storage or in a cookie that scripts can read.

### Requirement 5: Mock API mode

**User story:** As a developer or reviewer, I want to run the frontend without the backend, so that I can use the
shell with demo users.

#### Acceptance criteria

1. WHERE `USE_MOCK_API` is `true`, WHEN a documented demo user signs in THEN `POST /api/auth/login` SHALL set the
   session cookie with a mock token and return that user, without calling Fiducial_backend.
2. WHERE mock mode is on, IF the email or password does not match a demo user THEN the login route SHALL answer 401
   with the standard invalid-credentials message.
3. WHERE mock mode is on, `GET /api/proxy/auth/me` SHALL return the demo user for a valid mock token, and SHALL answer
   401 and clear the cookie for any other token.
4. WHERE mock mode is on, every other allowed `/api/proxy/*` request SHALL answer 503 with a "not available in demo
   mode" error without contacting the API, and the pages that need the API (masters, rating, users, settings) SHALL
   show a "Not available in demo mode" state rather than a generic error.
5. WHERE mock mode is on, the sign-in page and the navbar SHALL show a "Demo mode" notice.
6. WHERE `USE_MOCK_API` is anything other than `true`, including unset, the BFF SHALL use the real API and the demo
   credentials SHALL NOT work.
7. `.env.example` SHALL set `USE_MOCK_API=true` and explain both modes, and the README SHALL document the demo users.

### Requirement 6: Signed-in layout and sidebar

**User story:** As a team member, I want the same navigation on every page, so that I always know where I am and can
move around quickly.

#### Acceptance criteria

1. The app SHALL wrap every signed-in page in a layout with a sidebar, a top navbar and a main landmark, with a "Skip
   to content" link as the first focusable element.
2. The sidebar SHALL show the brand at the top, then these groups and items, each with a lucide icon:
   - Overview: Dashboard, Proposals (one item since 06 Oct 2026; the list page switches between new and existing)
   - Workflow: RFQ, Quotes and QCR, Placement Slips (all Planned), Fire rate check
   - Masters: Occupancy, Pincodes, Add-on Covers (Planned), Clauses (Planned), Insurers (Planned)
   - Admin, only for users with the ADMIN role: Users, Settings
3. The sidebar SHALL show each Planned item with a "Planned" tag, styled as unavailable and not navigable, and
   exposed to assistive technology as disabled with "Planned" in its name.
4. WHEN an item's page is shown THEN the sidebar SHALL mark that item with `aria-current="page"` and an active style
   that does not rely on colour alone. The active marker SHALL have at least 3:1 contrast with the colours next to it,
   and sidebar text SHALL meet AA, in both themes.
5. The sidebar SHALL show the signed-in user's name and role in its footer.
6. WHILE the screen is 1024 px wide or more, WHEN the user activates the sidebar toggle THEN the sidebar SHALL switch
   between expanded (icons and labels) and an icon-only rail. In the rail every item SHALL show its label in a
   tooltip on hover and on keyboard focus.
7. WHEN the user collapses or expands the sidebar THEN the app SHALL keep that state across reloads and sessions in
   that browser, and the server SHALL render the kept state so the layout does not shift on load.
8. WHILE the screen is narrower than 1024 px the sidebar SHALL be hidden and SHALL open as a slide-in drawer from the
   navbar's menu button. The drawer SHALL trap focus, close on Escape, on an overlay click and after navigation, and
   return focus to the menu button.

### Requirement 7: Top navbar

**User story:** As a team member, I want search, notifications, theme and account controls in one bar, so that common
actions are always one step away.

#### Acceptance criteria

1. The navbar SHALL show the sidebar toggle and breadcrumbs on the left, and the global search field, notifications
   button, theme control and user menu on the right.
2. The breadcrumbs SHALL follow the current route (for example Masters › Occupancy, or Proposals › PRP-2026-0104),
   link each ancestor that has a page, mark the current page with `aria-current="page"` and sit in a navigation
   landmark named "Breadcrumb".
3. WHEN the user activates the search field THEN the app SHALL open the command palette.
4. The notifications button SHALL include the unread count in its accessible name and show it as a badge. WHEN
   activated THEN it SHALL open a menu of 3 to 4 sample notifications (for example "Renewal due in 30 days" and
   "Quote received"), each with a relative time and a link to its proposal, plus "Mark all as read".
5. The user menu SHALL show the user's name, email and role, a Profile item that opens a placeholder page, and Sign
   out.
6. IF sign-out fails THEN the app SHALL keep the user signed in and show an error toast.
7. WHILE the screen is narrower than 640 px the navbar SHALL show a search icon button in place of the search field,
   and only the current page in the breadcrumbs.

### Requirement 8: Command palette

**User story:** As a team member, I want a keyboard-driven palette, so that I can find a proposal or page without
leaving the keyboard.

#### Acceptance criteria

1. WHEN the user presses Cmd+K on macOS or Ctrl+K elsewhere, anywhere in the signed-in app, THEN the app SHALL open the
   command palette. Pressing it again or Escape SHALL close it.
2. The palette SHALL trap focus while open, focus its search input on open and return focus to the previously focused
   element on close.
3. The palette SHALL list pages (the navigable sidebar items the user can see, without Planned items). WHEN the user
   has typed at least 2 characters THEN it SHALL also list proposals whose reference or client name matches, loaded
   through the data layer.
4. The palette SHALL support the arrow keys to move through results and Enter to open the highlighted one. A page
   result opens that page; a proposal result opens `/proposals/{id}`.
5. WHILE proposal results are loading, have failed or are empty the palette SHALL say so in the Proposals group.

### Requirement 9: Dashboard header and proposal type

**User story:** As an account or placement team member, I want to switch the dashboard between new business and
renewals, so that I see the work I am handling.

#### Acceptance criteria

1. The dashboard (`/dashboard`) SHALL show a greeting with the user's first name, today's date as DD MMM YYYY (IST)
   and a primary action button: "New proposal" for new proposals, "Start renewal" for existing proposals. The button
   opens a placeholder page.
2. The dashboard SHALL show a prominent two-option control, "New proposals" and "Existing proposals (renewals)", each
   with its proposal count.
3. WHEN the user selects an option THEN the dashboard SHALL update the KPI cards, pipeline strip, chart and table for
   that type, and set `?type=new` or `?type=existing` in the URL without a full page load or a new history entry.
4. WHEN the dashboard loads with `?type=new` or `?type=existing` THEN it SHALL show that type. IF the parameter is
   missing or invalid THEN it SHALL show new proposals.
5. WHEN the type changes THEN the dashboard SHALL clear the stage filter, the search text and the page number.
6. The dashboard, proposal lists and proposal pages SHALL label proposal content as sample data until a proposals API
   exists.

### Requirement 10: KPI cards

**User story:** As a manager, I want headline numbers for the selected type, so that I can see the workload at a
glance.

#### Acceptance criteria

1. The dashboard SHALL show four KPI cards for the selected type, each with a value, a short label and helper text:
   - New proposals: Open proposals, Awaiting quotes, Pending approval, Placed this month.
   - Existing proposals: Renewals due in 30 days, Renewals due in 60 days, Awaiting quotes, Placed this month.
2. The KPI values SHALL follow the definitions in design.md (KPI definitions).
3. The KPI cards SHALL show sums insured in compact Indian form, for example ₹12.40 Cr or ₹85.00 L.
4. The KPI cards SHALL NOT show trends the data cannot support. Helper text states a related fact, such as a total
   Fire SI (Proposed 1) or the nearest expiry.
5. Placed renewals SHALL NOT count towards the "Renewals due" cards.

### Requirement 11: Pipeline strip

**User story:** As a team member, I want to see how many proposals are in each stage and filter by one, so that I can
work through a stage.

#### Acceptance criteria

1. The dashboard SHALL show the six stages in order as chips, each with the number of proposals of the selected type
   in that stage.
2. WHEN the user selects a chip THEN the dashboard SHALL filter the table to that stage, mark the chip as pressed
   (`aria-pressed="true"`), show the same stage in the table's stage filter and set `?stage=` in the URL.
3. WHEN the user selects the active chip again THEN the dashboard SHALL clear the stage filter.
4. WHEN the stage filter in the table toolbar changes THEN the pipeline strip SHALL show the same selection.

### Requirement 12: Chart

**User story:** As a manager, I want a simple chart of the pipeline or of sums insured, so that I can compare at a
glance.

#### Acceptance criteria

1. The dashboard SHALL show one bar chart with a tab control to switch between "Proposals by stage" (six stages) and
   "Sum insured by product" (BSUS, BLUS, SFSP, PAR: the Fire SI (Proposed 1) total of each) for the selected type.
2. The chart SHALL take every colour (bars, axes, grid lines, tooltip) from the theme tokens, and SHALL follow a theme
   change without a reload.
3. The chart SHALL have a text alternative with the same values (a visually hidden table), and its labels and tooltip
   SHALL use the dashboard's number formats.
4. WHILE the chart data is loading or has failed the chart card SHALL show a skeleton, or an error with retry.

### Requirement 13: Proposals table

**User story:** As a team member, I want a searchable, sortable table of proposals, so that I can find the one I need
and see where it stands.

#### Acceptance criteria

1. The table SHALL show, for the selected type: Reference, Client, Type (badge), Product, Fire SI (Proposed 1), Sections
   included (for example 6/14), Stage, Insurers responded (for example 3/5), Due or renewal date, Owner.
2. WHEN the user types in the search field THEN the table SHALL filter by reference or client name, ignoring case,
   after a short pause.
3. The table SHALL offer a stage filter linked to the pipeline strip.
4. WHEN the user activates a sortable column header THEN the table SHALL sort by that column, toggling between
   ascending and descending, and expose the order with `aria-sort`. By default it SHALL sort by due or renewal date,
   earliest first.
5. The table SHALL paginate, with Previous and Next controls and a "Showing x–y of z" summary.
6. For existing proposals the date column SHALL show a days-to-expiry chip with the days in text: danger from 0 to 30
   days and for expired policies ("Expired"), warning from 31 to 60 days, neutral above 60 days. A placed
   renewal's chip SHALL be neutral.
7. Rows SHALL show a hover state, and each row SHALL contain a focusable control that opens the proposal. WHEN the user
   clicks a row or activates that control THEN the app SHALL open the proposal components drawer.
8. WHILE data is loading the table SHALL show skeleton rows. IF there are no results THEN it SHALL show an empty state
   that says why and offers an action (clear filters, or the type's primary action). IF loading fails THEN it SHALL
   show an error with a retry button.
9. WHILE the screen is narrower than the table the table SHALL scroll horizontally inside its own labelled container,
   which can be scrolled from the keyboard.

### Requirement 14: Proposal components drawer

**User story:** As a team member, I want to see every component of a proposal from the table, so that I can check it
without leaving the dashboard.

#### Acceptance criteria

1. WHEN a proposal is opened from the table THEN the app SHALL show a right-side drawer, full screen below 640 px,
   titled with the client name and reference.
2. The drawer SHALL show, in this order: Summary, Stage stepper, Coverage sections, Add-ons, Clauses and excess,
   Insurers and quotes, Documents and Activity, with a footer holding "Open full proposal" and "Close".
3. The Summary SHALL show the type badge, product, policy period, stage and owner, and for renewals the existing
   policy's insurer and expiry date.
4. The stage stepper SHALL show the six stages horizontally, mark the completed stages and mark the current stage
   with `aria-current="step"`.
5. The Coverage sections SHALL list all 14 sections in the glossary order, each marked "Included" or "Not included" in
   text, with the sum insured per option: Existing, Proposed 1 and Proposed 2 for renewals, Proposed 1 and Proposed 2
   for new proposals. For a new proposal the drawer SHALL NOT show an Existing column. A totals row SHALL add up the
   included sections per option, in Indian grouping.
6. The Add-ons part SHALL show how many add-ons are selected out of the product's catalogue (for example 4 of 20),
   and the first few names.
7. The Clauses and excess part SHALL show the number of clauses, the number of excess entries and a short summary.
8. The Insurers and quotes part SHALL list up to 5 insurers with a status badge each. IF no insurer is selected yet
   THEN it SHALL say so.
9. The Documents part SHALL list the Data Sheet, RFQ, QCR and Placement Slip with status badges and disabled download
   buttons marked "Coming soon".
10. The Activity part SHALL show the last 5 events, newest first, each with its time and who did it.
11. The drawer SHALL trap focus, close on Escape or Close, and return focus to the control that opened it.
12. WHILE the proposal is loading or has failed the drawer SHALL show a skeleton, or an error with retry.

### Requirement 15: Full proposal page

**User story:** As a team member, I want a full-page view of a proposal, so that I can read every component with more
room and share a link to it.

#### Acceptance criteria

1. The page `/proposals/{id}` SHALL show the proposal header (client, reference, type badge, stage) and these tabs:
   Overview, Coverage, Add-ons, Clauses and Excess, Insurers and Quotes, Documents, Activity.
2. The page SHALL render the same section components as the drawer, read-only, with no duplicated components.
3. The tabs SHALL follow the WAI-ARIA tabs pattern: one tab stop, and the arrow keys move between tabs.
4. IF the id matches no proposal THEN the page SHALL show a "Proposal not found" state with a link to the proposal
   lists.
5. WHILE the proposal is loading or has failed the page SHALL show a skeleton, or an error with retry.

### Requirement 16: Proposal lists and placeholder pages

**User story:** As a team member, I want every navigation item and action to lead somewhere sensible, so that the
navigation never dead-ends.

#### Acceptance criteria

1. The page `/proposals?type=new|existing` SHALL show the proposals table and drawer for that type. The sidebar's
   Proposals item links here (`/proposals`, new by default).
2. The primary action ("New proposal" or "Start renewal") SHALL open `/proposals/new?type=new|existing`, a placeholder
   marked Planned that says proposal creation is planned.
3. The signed-in layout SHALL include `/profile` (placeholder) and `/settings`. Settings is for ADMIN users and SHALL
   show the system status and active master versions that the current dashboard shows.
4. IF a user without the ADMIN role opens `/settings` THEN the app SHALL show a "You do not have access" state.

### Requirement 17: Existing features in the new shell

**User story:** As a current user, I want the masters, rating and user pages to keep working, so that the new shell
loses nothing.

#### Acceptance criteria

1. The Occupancy, Pincodes, Fire rate check and Users pages SHALL keep their current behaviour inside the new layout,
   in both themes.
2. WHERE mock mode is off, the BFF allowlist, same-origin checks and 401 handling SHALL keep their current behaviour.

### Requirement 18: Data layer and domain types

**User story:** As a developer, I want one typed data layer, so that replacing the sample data with the real API
touches one folder.

#### Acceptance criteria

1. The domain enums and types (ProposalType, Stage, Product, SectionCode, SumInsuredOption, QuoteStatus, DocStatus,
   DocumentKind) and their display labels SHALL be defined once, in `src/types/proposal.ts`, and reused everywhere.
2. The sample data SHALL live in `src/lib/data/` and a unit test SHALL validate it against the domain schemas.
3. Components SHALL get proposal and notification data only through the hooks in `src/lib/api/`
   (`useProposals({ type, stage, q, sort, page })`, `useProposal(id)`, `useDashboardStats(type)` and
   `useNotifications()`), never by importing `src/lib/data`.
4. The data layer SHALL return promises with simulated latency (none in tests) and SHALL report failures with the same
   `ApiError` type as the real API client, including a not-found error for an unknown id.
5. The sample data SHALL have 14 proposals, 7 new and 7 existing (design.md D18), with: every stage and every product
   in each type; 4 to 14 included sections each; up to 5 insurers each; Fire SI (Proposed 1) from ₹40 lakh to ₹120 Cr;
   fictional Indian company names; and products that match the thresholds in the glossary.
6. The sample dates SHALL be relative to today, so that on any day there are unplaced renewals due within 30 days,
   within 31 to 60 days and within 61 to 90 days, and at least one proposal of each type placed in the current month.
7. The types SHALL make an Existing sum insured impossible on a new proposal.

### Requirement 19: Money and dates

**User story:** As a team member, I want amounts and dates shown the way Indian insurance documents show them, so that
I can read them without converting.

#### Acceptance criteria

1. The app SHALL hold amounts as whole-rupee strings and add them with integer (BigInt) arithmetic, never floating
   point. Only chart bar heights may use a number derived for drawing.
2. The app SHALL format full amounts with Indian grouping and 2 decimals, for example ₹1,36,880.00.
3. The app SHALL format compact amounts in lakh (L) and crore (Cr) with 2 decimals, rounding half up (for example
   ₹85.00 L and ₹12.40 Cr), and SHALL switch to crore when the rounded lakh value reaches 100.
4. The app SHALL show dates as DD MMM YYYY, and SHALL work out today, days to expiry and the current month in IST.

### Requirement 20: Responsive layout

**User story:** As a team member on a laptop, a tablet or a phone, I want the app to fit my screen, so that I can
check a proposal anywhere.

#### Acceptance criteria

1. The app SHALL work from 360 px wide to wide desktops with no horizontal page scrolling. Only tables may scroll
   horizontally, inside their containers.
2. The KPI cards SHALL reflow from 4 columns on wide screens to 2 and then 1.
3. The pipeline strip SHALL scroll horizontally on narrow screens without hiding any stage.

### Requirement 21: Keyboard and screen reader access

**User story:** As a keyboard or screen reader user, I want every part of the app to be operable and announced, so
that I can do my work without a mouse.

#### Acceptance criteria

1. Every interactive element SHALL be reachable and operable from the keyboard in a logical order, with a visible
   focus indicator.
2. Overlays (command palette, drawers, dialogs, menus) SHALL trap focus while open, close on Escape and return focus
   to the element that opened them.
3. The layout SHALL use landmarks (banner, navigation, main and the sidebar), and every icon-only button SHALL have an
   accessible name.
4. Data tables SHALL use table markup with column headers.
5. The app SHALL NOT convey status by colour alone; badges and chips carry text.
6. Loading states SHALL be announced politely (`role="status"`) and errors SHALL use `role="alert"`.

### Requirement 22: States, code quality and tests

**User story:** As a developer, I want the shell built to the project's quality gates, so that it stays easy to
change.

#### Acceptance criteria

1. Every data view (KPI cards, chart, table, drawer, full page, palette results and notifications) SHALL have loading,
   empty and error states.
2. `npm run lint`, `npm run typecheck`, `npm test` and `npm run build` SHALL pass in Fiducial_frontend.
3. Reusable components SHALL live in `src/components/ui` (shadcn primitives), `src/components/layout` and
   `src/components/proposals`. No new component file SHALL exceed about 250 lines.
4. The tests SHALL include React Testing Library tests for: the theme control changing the `<html>` class; the
   dashboard type switch changing the URL and the content; the drawer showing no Existing column for a new proposal;
   and the Indian currency formatters. They SHALL also cover the sample data rules, token contrast and the mock-mode
   routes.
5. A Playwright smoke test (Chromium only, run by `npm run test:e2e` and its own CI job) SHALL sign in as the demo user and load the dashboard
   in the light and dark themes.

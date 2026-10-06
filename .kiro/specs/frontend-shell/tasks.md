# Implementation plan: frontend shell

Work happens in five vertical slices, in the brief's order, then a wrap-up. After each task, run `npm run lint`,
`npm run typecheck` and `npm test` in Fiducial_frontend and fix every problem before the next task. Each slice ends with
a checkpoint that adds `npm run build`. All questions are answered (design.md, Approved answers), so every task is in
scope. Install packages with exact versions (`--save-exact`), after confirming on npm that the exact version exists; if
one does not resolve, stop and ask instead of substituting another. The property test tasks follow design.md
(Correctness Properties) and use `fast-check@4.10.2` (dev); the first of them installs it.

- [x] 1. Theme and tokens
- [x] 1.1 Add next-themes and the theme provider
  - Install `next-themes@0.4.6`.
  - Add `src/components/layout/theme-provider.tsx` (next-themes with `attribute="class"`, `defaultTheme="system"`,
    `enableSystem`, `disableTransitionOnChange`, `storageKey="erp-theme"`) with the development-only filter for the
    known script-tag false positive (design.md, Theme and tokens), and a Radix `TooltipProvider` in `providers.tsx`.
  - Set `suppressHydrationWarning` on `<html>`.
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
- [x] 1.2 Rewrite the colour tokens
  - Replace the tokens in `globals.css` with the light and dark values in design.md, add the dark custom variant and
    map every token in `@theme inline` (adds `info`, `accent-strong`, `chart-1` to `chart-4`,
    `sidebar-active-foreground`, `sidebar-ring`, `sidebar-border` and `overlay`).
  - Update the primitives: Badge accent variant and Button link variant use `accent-strong`; Alert info uses the
    `info` tokens; inputs use `border-input` and a solid `ring-ring` focus ring; the Dialog and Sheet backdrops use
    `bg-overlay/50`. Replace other uses of accent as text colour with `accent-strong` (occupancy code buttons, sign-in
    heading). Sidebar text uses the `sidebar-*` tokens only.
  - The `prefers-reduced-motion` rule gains `animation-iteration-count: 1` and `scroll-behavior: auto`.
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 2.7, 1.6_
- [x] 1.3 Build the theme control
  - Add `RadioGroup` and `RadioItem` to `src/components/ui/dropdown-menu.tsx`.
  - `src/components/layout/theme-toggle.tsx`: DropdownMenu with a Light, Dark and System radio group; icon switched by
    `dark:` classes; accessible name "Theme".
  - Test: choosing Dark adds `dark` to `<html>`, choosing Light removes it, and the choice is stored.
  - _Requirements: 1.2, 1.5, 22.4_
- [x] 1.4 Guard the tokens with tests
  - `vitest.setup.ts`: stubs for `matchMedia`, `ResizeObserver`, pointer capture and `Element.scrollIntoView`.
  - `src/app/tokens.test.ts`: parse the `:root` and `.dark` blocks of `globals.css` and check every pair in design.md
    against its minimum ratio (Property 14: Token pairs meet their contrast minimums); fail on hex, rgb or hsl colour
    literals in `src/app` and `src/components` outside `globals.css`.
  - _Requirements: 2.3, 2.4_
- [x] 1.5 Checkpoint: lint, typecheck, test and build pass. Check the existing pages in light and dark with the dev
      server.

- [x] 2. Layout
- [x] 2.1 Navigation config and primitives
  - `src/components/layout/nav-config.ts` with the groups, items, icons, targets, roles and Planned flags from
    design.md.
  - Add shadcn primitives: tooltip, breadcrumb, separator, kbd.
  - _Requirements: 6.2, 6.3_
- [x] 2.2 Sidebar and app shell
  - `src/components/layout/sidebar/`: brand, grouped items with `aria-current`, Planned items as
    `role="link" aria-disabled="true"` without `href` and still focusable, with a "Planned" tag; Admin group by role;
    user footer (initials with a tooltip in the rail); expanded and rail modes, with tooltips on hover and focus.
  - Collapse state in the `erp_sidebar` cookie; `(app)/layout.tsx` reads it (and mock mode) and passes them to
    `AppShell`, which provides demo mode through `DemoModeProvider` (`src/lib/demo-mode.ts`).
  - `AppShell`: skip link, frame rendered at once, user-dependent parts with skeletons, error state in `main`.
    `(app)/error.tsx` shows unexpected render errors inside the shell.
  - Mobile drawer below 1024 px using the existing Sheet: always expanded, closes after navigation, and focuses the
    menu button again in `onCloseAutoFocus`.
  - Replace `src/components/app-shell/` with `src/components/layout/`.
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 21.1, 21.2, 21.3_
- [x] 2.3 Navbar
  - Desktop collapse toggle and mobile menu button, breadcrumbs from the route map, search trigger with the shortcut
    hint, theme control, user menu (name, email, role, Profile, Sign out with the error toast), Demo mode badge.
  - Below 640 px: a "Search" icon button, the current breadcrumb only, the user's initials, and "Demo" as the badge.
  - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7, 5.5, 20.1_
- [x] 2.4 Notifications menu
  - Temporary sample notifications behind `useNotifications()` in `src/lib/api/notifications.ts` (rebuilt from the
    sample proposals in 4.4).
  - Bell button named with the unread count ("Notifications, 3 unread") and a badge; items with relative times
    (`Intl.RelativeTimeFormat`) and links; Mark all as read; loading, empty and error states.
  - _Requirements: 7.4, 22.1_
- [x] 2.5 Command palette
  - Install `cmdk@1.1.1` and add the shadcn Command primitive.
  - ⌘K on macOS and Ctrl+K elsewhere toggle it from anywhere in the shell, including text fields, with
    `preventDefault()`; the navbar trigger opens it; Pages group from `nav-config.ts` filtered by role and label;
    focus returns to the element that had it, in `onCloseAutoFocus`. Proposal search follows in 4.14.
  - _Requirements: 8.1, 8.2, 8.4_
- [x] 2.6 Settings and Profile pages
  - Add `AccessDeniedState` and `DemoModeState` to `src/components/states.tsx`.
  - `/settings` (ADMIN): move the System status and Master data cards from the current dashboard. Other roles get
    `AccessDeniedState`, and demo mode gets `DemoModeState`; neither sends a request.
  - `/profile`: move the "Signed in as" card and add a "Profile settings are planned" note.
  - Replace the old dashboard view with a temporary heading until slice 4.
  - The new states follow the existing ones: loading with `role="status"`, errors with `role="alert"`.
  - _Requirements: 16.3, 16.4, 17.1, 21.6_
- [x] 2.7 Layout tests
  - Replace `sidebar-nav.test.tsx`: Admin group by role, Planned items disabled and not links, `aria-current`, the
    collapse toggle writes the cookie, and closing the mobile drawer returns focus to the menu button.
  - Breadcrumbs for a nested route (the proposal routes and their tests follow in 5.4).
  - _Requirements: 6.2, 6.3, 6.4, 6.7, 6.8, 7.2_
- [x] 2.8 Checkpoint: lint, typecheck, test and build pass. Check keyboard navigation, the rail tooltips and the
      mobile drawer in both themes.

- [x] 3. Login
- [x] 3.1 Auth layout and pages
  - Move `src/app/login` into the `(auth)` route group with a shared layout: two-column panel at 1024 px and wider
    (product name, one-line description, three value points from design.md), form only below, theme control. The
    layout calls `await connection()` before reading `USE_MOCK_API`.
  - `/forgot-password` placeholder with a link back to sign-in.
  - _Requirements: 3.1, 3.9, 1.5_
- [x] 3.2 Sign-in form
  - Password show and hide button, "Forgot password?" link, focus on the first invalid field, and the current
    failure, spinner and `next` handling.
  - Harden `safeNextPath()`: reject backslashes, control characters (C0, DEL and C1) and a leading `//`, then
    resolve `next` with the URL parser and accept it only on the app's origin and not
    `/login`, so values such as `/%09/evil.example` no longer leave the site.
  - In demo mode, wrong credentials show the plain invalid-credentials message, without the lockout sentence.
  - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8_
- [x] 3.3 Mock API mode
  - `src/lib/server/mock-mode.ts`: `isMockApi()`, demo users (fixed ObjectId-format ids and dates, so they pass
    `UserSchema`), mock token helpers.
  - Login, logout and proxy routes: the mock branches from design.md; real mode unchanged.
  - `src/lib/demo-mode.ts`: `DEMO_MODE_CODE`, `isDemoModeError()`, `DemoModeProvider`, `useDemoMode()`. The masters,
    rating, users and settings pages show `DemoModeState` in demo mode without sending requests; the query retry rule
    in `providers.tsx` skips `DEMO_MODE` errors.
  - Demo notice on the auth layout; `.env.example` with `USE_MOCK_API=true` and both modes explained.
  - _Requirements: 4.1, 4.2, 4.5, 4.6, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 17.2_
- [x] 3.4 Route protection
  - `src/proxy.ts`: public paths `/login` and `/forgot-password`; redirects as in design.md.
  - _Requirements: 4.3, 4.4_
- [x] 3.5 Login tests
  - Sign-in form: show and hide password, Forgot password link, inline errors.
  - `safeNextPath`: same-site paths kept; rejected: `//evil.example`, `/\evil.example`, tab, carriage return, newline
    and other control characters, absolute and protocol-relative URLs to other origins, and `/login`.
  - Routes: mock sign-in success and failure, demo credentials rejected when mock mode is off, `auth/me` and 503 in
    mock mode, non-mock token cleared.
  - `src/proxy.test.ts`: public paths and redirects.
  - _Requirements: 3.2, 3.3, 3.8, 3.9, 4.3, 4.4, 5.1, 5.2, 5.3, 5.4, 5.6_
- [x] 3.6 Property tests for mock mode and redirects
  - Install `fast-check@4.10.2` (dev, exact).
  - **Property 12: Mock mode is opt-in and narrow**
  - **Property 13: Sign-in redirects stay on this site**
  - **Validates: Requirements 3.8, 5.2, 5.3, 5.6**
- [x] 3.7 Checkpoint: lint, typecheck, test and build pass. With `USE_MOCK_API=true`, sign in as each demo user and
      confirm the Admin group appears only for the admin.

- [x] 4. Dashboard
- [x] 4.1 Domain types
  - `src/types/proposal.ts`: constant arrays, labels, Zod schemas (discriminated union, strict objects) and inferred
    types, `ProposalSummary`.
  - _Requirements: 18.1, 18.7_
- [x] 4.2 Money and dates
  - `src/lib/money.ts` (`sumRupees`, `formatInr`, `formatInrCompact`) and `src/lib/dates.ts` (IST helpers), with tests
    for the formatter cases in design.md.
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 22.4_
- [x] 4.3 Property tests for money and dates
  - **Property 1: Full amounts keep every digit**
  - **Property 2: Compact amounts are within half a hundredth**
  - **Property 3: Sums are exact in any order**
  - **Property 4: Dates follow the IST calendar**
  - **Validates: Requirements 13.6, 14.5, 19.1, 19.2, 19.3, 19.4**
- [x] 4.4 Sample data
  - `src/lib/data/catalogues.ts`, `proposals.ts` (`buildSampleProposals(now)`, the 14 proposals in design.md, with no
    time after `now`) and `notifications.ts` (built from the proposals).
  - For every option, the Fire SI and the total across the included sections stay inside the product's band.
  - Test: schema validity and every rule in Requirement 18 on fixed dates, including the first and last day of a
    month.
  - _Requirements: 18.2, 18.5, 18.6, 18.7_
- [x] 4.5 Property test for the sample data
  - **Property 5: Sample data rules hold at any moment**
  - **Validates: Requirements 18.5, 18.6**
- [x] 4.6 Data layer and metrics
  - `src/lib/api/proposals.ts` and `notifications.ts`: functions with simulated latency (none in tests), `ApiError`
    for not found, hooks `useProposals`, `useProposal`, `useDashboardStats`, `useNotifications`; query keys in
    `src/lib/query-keys.ts`. The sample data is built once per IST day.
  - `src/lib/proposal-metrics.ts`: summary fields (with the Fire SI (Proposed 1)), KPI inputs (placed renewals are
    never due), days to expiry, `expiryUrgency()` (danger 0 to 30 days or expired, warning 31 to 60, neutral above 60
    or placed), `expiryLabel()`,
    `coverageColumns()` and `coverageTotals()`. Sorting breaks ties by reference.
  - ESLint `no-restricted-imports` for `@/lib/data/*` and relative paths into `lib/data`, outside `src/lib/api` and
    tests.
  - _Requirements: 18.3, 18.4, 10.2, 10.5, 13.4, 13.6, 14.5_
- [x] 4.7 Property tests for the data layer and metrics
  - **Property 6: Option columns follow the proposal type**
  - **Property 7: Coverage totals add up the included sections**
  - **Property 8: Listing matches a reference filter**
  - **Property 9: Dashboard figures agree with the proposals**
  - **Property 10: Expiry urgency follows the thresholds**
  - **Validates: Requirements 8.3, 9.2, 10.2, 10.5, 11.1, 12.1, 13.2, 13.3, 13.4, 13.5, 13.6, 14.5, 18.7**
- [x] 4.8 URL state
  - `src/lib/use-url-search-params.ts` (server snapshot from `searchParams`, `history.replaceState` writes) and
    `src/lib/proposal-params.ts` (parses and writes `type` and `stage`, shared by the dashboard and the lists).
  - _Requirements: 9.3, 9.4, 9.5, 11.2_
- [x] 4.9 Property test for URL state
  - **Property 11: URL state survives a round trip**
  - **Validates: Requirements 9.3, 9.4, 9.5, 11.2, 11.3**
- [x] 4.10 Header, type switch and KPI cards
  - Greeting with first name (morning, afternoon or evening by the IST hour) and the IST date, both from
    `useIstNow()` (`src/hooks/use-ist-now.ts`: browser clock, skeleton until hydrated); primary action to the
    placeholder; sample-data note.
  - `TypeSwitch` (Radix Tabs with counts) and `KpiCards` with the definitions and helper text from design.md, with
    loading and error states.
  - _Requirements: 9.1, 9.2, 9.3, 9.6, 10.1, 10.2, 10.3, 10.4, 10.5, 20.2_
- [x] 4.11 Pipeline strip
  - Six toggle buttons with counts and `aria-pressed`, synced with `?stage=`, horizontal scroll on narrow screens.
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 20.3_
- [x] 4.12 Chart
  - Install `recharts@3.10.1` and `react-is@19.3.0`. `StageChart` with the two tabs (stage counts, and Fire SI (Proposed 1) by product), token colours, compact labels,
    the visually hidden data table, loaded with `next/dynamic`.
  - _Requirements: 12.1, 12.2, 12.3, 12.4_
- [x] 4.13 Proposals table
  - Columns from design.md, with "Fire SI (Proposed 1)" as the sum insured column.
  - Toolbar (debounced search, stage select, result count), sortable headers with `aria-sort`, pagination, expiry
    chip, row hover and the Reference button, scroll region, and loading, empty and error states.
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 21.4, 21.6_
- [x] 4.14 Proposal search in the command palette
  - Proposals group using `useProposals({ q, pageSize: 6 })` from 2 characters, with loading, error and empty
    messages.
  - _Requirements: 8.3, 8.5_
- [x] 4.15 Dashboard test
  - Switching to Existing sets `?type=existing`, changes the KPI labels and shows only renewals; selecting a stage
    chip filters the table and selecting it again clears it.
  - _Requirements: 9.3, 11.2, 11.3, 22.4_
- [x] 4.16 Checkpoint: lint, typecheck, test and build pass. Check the dashboard in both themes, on a phone width and
      with the keyboard only.

- [x] 5. Proposal components
- [x] 5.1 Badges and section components
  - Badges for type, stage, quote status, document status and the expiry chip.
  - `src/components/proposals/sections/`: summary, stage stepper, coverage table (columns from the type, totals
    row), add-ons, clauses and excess, insurers and quotes, documents (disabled "Coming soon" downloads), activity.
  - _Requirements: 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10, 21.5_
- [x] 5.2 Proposal drawer
  - Right-side Sheet, full screen below 640 px, title with client and reference, sections in order, footer with Open
    full proposal and Close, loading and error states. Focus returns to the row's Reference button in
    `onCloseAutoFocus`. Wire it into the dashboard table.
  - _Requirements: 14.1, 14.2, 14.11, 14.12_
- [x] 5.3 Full proposal page
  - `/proposals/[id]`: header and Radix Tabs (Overview, Coverage, Add-ons, Clauses and Excess, Insurers and Quotes,
    Documents, Activity) reusing the section components; not-found, loading and error states.
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
- [x] 5.4 Proposal list and placeholder
  - `/proposals?type=…` with the type links, table and drawer; `/proposals/new?type=…` placeholder with a "Planned"
    badge.
  - Breadcrumbs for the list, the placeholder and `/proposals/{id}` (last crumb from `useProposal(id)`), with tests.
  - _Requirements: 16.1, 16.2, 7.2_
- [x] 5.5 Drawer test
  - A new proposal shows Proposed 1 and Proposed 2 and no Existing column; a renewal shows all three; the totals row
    matches the sum of the included sections; Close returns focus to the row's Reference button.
  - _Requirements: 14.5, 14.11, 22.4_
- [x] 5.6 Checkpoint: lint, typecheck, test and build pass. Open several proposals from the table and from the
      palette, in both themes.

- [x] 6. Wrap-up
- [x] 6.1 Documentation
  - README: demo users and password, `USE_MOCK_API`, themes, where sample data lives and how to swap it for the API.
  - Refresh the steering files to match what was built.
  - _Requirements: 5.7_
- [x] 6.2 Playwright smoke test
  - Install `@playwright/test@1.63.0` (dev, exact) and the Chromium browser only. `playwright.config.ts` starts the
    production build with `USE_MOCK_API=true`.
  - `e2e/smoke.spec.ts`: one test that signs in as the demo admin and checks the dashboard in light and dark.
  - `npm run test:e2e`, separate from `npm test`; a separate CI job that caches `~/.cache/ms-playwright`, keyed on the
    Playwright version.
  - Ignore Playwright's reports and results in `.gitignore`, `.prettierignore` and ESLint.
  - _Requirements: 22.5_
- [x] 6.3 Final verification
  - Lint, typecheck, test and build; then, with `npm run dev` and `USE_MOCK_API=true`, walk through the brief's
    definition of done in light, dark and system themes, including a reload with no theme flash.
  - Confirm the new components sit in `src/components/ui`, `layout` and `proposals`, and no new component file is
    over about 250 lines.
  - Report the versions chosen, deviations from the brief and anything not done.
  - _Requirements: 22.2, 22.3_

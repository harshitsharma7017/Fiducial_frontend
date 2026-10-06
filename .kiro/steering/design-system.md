# Design system (frontend)

A calm, dense but readable back-office look for long working sessions. Hierarchy comes from whitespace and
typography. No gradients, glass effects, large illustrations or decorative animation.

## Colour

- Every colour is a CSS variable in `src/app/globals.css` (shadcn convention: `--background`, `--card`, `--border`,
  `--input`, `--ring`, `--foreground`, `--muted-foreground`, `--primary`, `--accent`, `--success`, `--warning`,
  `--destructive`, `--info`, `--chart-*`, `--sidebar-*`), with light values in `:root` and dark values in `.dark`,
  mapped in `@theme inline`.
- Components use token utilities only (`bg-card`, `text-muted-foreground`, `border-input`). Never write hex, rgb or
  hsl values in components.
- Contrast must meet WCAG AA in both themes: 4.5:1 for text, including badges, chips and table text; 3:1 for focus
  rings, form field borders and chart bars. When adding a token pair, add it to the contrast test.
- Primary is navy (`--primary`); accent is teal (`--accent`). Use `text-accent-strong` for accent-coloured text:
  plain accent is too light for text on the light page background.
- `--border` is for decorative dividers. Form fields use `border-input`.
- Dialog and drawer backdrops use `bg-overlay/50`, never `bg-foreground/…`, which turns light in dark mode. Sidebar
  text uses the `sidebar-*` tokens, not `primary-foreground`.
- Status colours pair a strong tone with a soft background (`bg-success-soft text-success`). Status always has a
  text label too, never colour alone.

## Theme

- next-themes with the `class` strategy: Light, Dark and System (default). The theme control appears in the navbar
  and on the sign-in pages.
- Check every new surface in both themes, including menus, tooltips, skeletons and charts. Charts take colours from
  `var(--chart-*)`, `var(--border)` and `var(--muted-foreground)`.

## Typography and density

- System font stack. Body text is `text-sm`; page titles `text-xl font-semibold`; section titles `text-base`.
- Use `tabular-nums` for every amount, count and date. Right-align amounts in tables.
- Amounts: `formatInr` (₹1,36,880.00) in detail views, `formatInrCompact` (₹12.40 Cr, ₹85.00 L) in cards, tables and
  charts. Dates: DD MMM YYYY.

## Components and states

- Start from the shadcn primitives in `src/components/ui`. Build on Radix through the `radix-ui` package.
- Every data view has loading (skeleton, `role="status"`), empty (message plus an action) and error (`role="alert"`
  with retry) states. Reuse `src/components/states.tsx`.
- Planned features show as disabled items with a "Planned" tag; unavailable actions as disabled buttons marked
  "Coming soon".

## Interaction and accessibility

- Visible focus on every control: `focus-visible:ring-2 ring-ring ring-offset-2` (`ring-sidebar-ring` in the sidebar).
- Overlays (dialogs, drawers, menus, the command palette) trap focus, close on Escape and return focus to their
  trigger. Use the Radix-based primitives rather than custom overlays. Radix returns focus only to its own
  `Trigger`; an overlay opened any other way restores focus in `onCloseAutoFocus`.
- Use landmarks, `aria-current` for the current page or step, `aria-pressed` for toggle chips, `aria-sort` on sorted
  columns, and an accessible name on every icon-only button.
- Respect `prefers-reduced-motion`: animations are short, functional and `motion-safe:` where optional.
- Responsive: sidebar drawer below 1024 px, full-screen drawers below 640 px, tables scroll inside a labelled,
  focusable container.

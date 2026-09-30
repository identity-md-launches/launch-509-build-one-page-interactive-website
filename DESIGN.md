# Wallet Constellation design system

This document describes the design as implemented in the final source. Every value below
is taken from `src/styles.css` (tokens and all component styles) and the components in
`src/components/`. Use it to add another surface that belongs to the same product.

## Overview

Wallet Constellation is a single-page tool for people who want to understand an Ethereum
address at a glance: analysts, curious wallet owners, researchers. The visual character is
a dark, quiet "star map": a near-black navy page, translucent navy cards with soft
shadows, a single warm gold centre star, and three data hues (amber, mint, violet) that
carry meaning only inside the map, chips, badges and counts. Everything else is neutral.

System-wide rules:

- One accent (sky blue) means interactive: links, the primary button fill, focus rings,
  selected table rows. It is never used for static text.
- Data hues have one meaning each: amber = outgoing, mint = incoming, violet = contract.
  Colour is always paired with a second cue (dashed line, diamond shape, label text).
- Density is comfortable rather than compact: 16 px card padding, 44 px primary controls,
  40 px secondary controls, 32 px inline copy buttons.
- Space groups content; borders are structural (card edges, table dividers); shadows carry
  elevation.

Page-specific arrangements (the hero, the map/details split, the stats row) are documented
in Layout but are not rules for every future page.

## Colors

All colours are hex sRGB in `src/styles.css` (`:root`, lines 5–48). Primitives are named by
hue and are never referenced by components; components use the semantic tokens.

Primitives:

| Token | Value | Token | Value |
| --- | --- | --- | --- |
| `--navy-950` | `#070b16` | `--slate-400` | `#8d9bbb` |
| `--navy-900` | `#0e1424` | `--slate-300` | `#aab6d0` |
| `--navy-800` | `#141c30` | `--slate-200` | `#cfd7ea` |
| `--navy-700` | `#1b2540` | `--slate-100` | `#eaeffa` |
| `--navy-600` | `#253352` | `--sky-300` | `#8ccaff` |
| `--navy-500` | `#35466e` | `--sky-500` | `#4a9cf6` |
| `--navy-400` | `#5870a6` | `--gold-300` | `#ffd166` |
| `--amber-300` | `#ffb86b` | `--mint-300` | `#5ee6b0` |
| `--violet-300` | `#b99cff` | `--rose-300` | `#ff8ba3` |
| `--rose-900` | `#3a1520` | | |

Semantic tokens and their jobs:

| Token | Points at | Use |
| --- | --- | --- |
| `--color-bg-page` | navy-950 | `body` background |
| `--color-bg-surface` | navy-900 | cards, inputs, chips, table, map stage |
| `--color-bg-raised` | navy-800 | secondary buttons, code blocks, transaction rows, selected table row, skeletons |
| `--color-bg-hover` | navy-700 | hover fill for ghost/icon/copy/row buttons and chips |
| `--color-bg-active` | navy-600 | reserved for pressed fills (currently unused by components) |
| `--color-border` | navy-600 | structural edges: cards, table dividers, map stage |
| `--color-border-strong` | navy-400 | control boundaries: input, ghost/icon/copy buttons, chips. Measured ≥ 3.46:1 against every surface it sits on |
| `--color-text-primary` | slate-100 | headings, values, body |
| `--color-text-secondary` | slate-300 | lead paragraph, labels, legend, eyebrow text |
| `--color-text-muted` | slate-400 | hints, captions, timestamps, counts (never below 13 px) |
| `--color-accent` | sky-300 | links, hovered primary button, pressed table row text |
| `--color-accent-solid` | sky-500 | primary button fill, skip link, `::selection` |
| `--color-on-accent` | navy-950 | text on accent fills |
| `--color-focus-ring` | sky-300 | every `:focus-visible` outline and the SVG selection ring |
| `--color-center-star` | gold-300 | the queried wallet's star, header mark, glow |
| `--color-outgoing` | amber-300 | outgoing edges, chip, "Sent" values |
| `--color-incoming` | mint-300 | incoming edges, chip, "Received" values, copied state |
| `--color-contract` | violet-300 | contract stars, dashed legend line, chip, badge |
| `--color-wallet-star` | slate-200 | wallet stars |
| `--color-danger` / `--color-danger-bg` | rose-300 / rose-900 | invalid field border and text, error banner, "Failed" badge |

Measured contrast (WCAG 2.x, `test/scratch/contrast.mjs` and rendered sampling in the
browser check): text-primary on surface 15.93:1, text-secondary on surface 9.01:1,
text-muted on raised 6.09:1 (the lowest text pair), accent link on page 11.24:1, on-accent
text on the primary button 6.90:1, danger text on danger background 7.24:1, focus ring
against page/surface/raised 11.24 / 10.49 / 9.69:1, border-strong against surface 3.74:1
and against raised 3.46:1. The structural `--color-border` (1.46:1 on surface) is
deliberately faint and never the only boundary of a control.

There is no light theme. `color-scheme: dark` is declared on `:root` and in
`index.html`'s meta tag so native form controls and scrollbars match.

## Typography

Fonts (`--font-sans`, `--font-mono`, `src/styles.css` lines 51–52): the system UI stack
(`Inter` if installed, then `ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto,
"Helvetica Neue", Arial`) and the system monospace stack for addresses, hashes and the
address input. No font files ship with the site; screenshots were rendered with the
container's fallback sans-serif, so the exact face varies by platform.

Weights used: 400 (body), 600 (labels, buttons, eyebrow, table headers) and 650
(headings, stat values, banner titles). No weight below 400 anywhere.

Scale (rem, 16 px base):

| Token | Size | Role |
| --- | --- | --- |
| `--text-xs` | 13 px | captions, badges, counts, table headers, legend, code addresses |
| `--text-sm` | 14 px | UI text: buttons, hints, table cells, details facts labels |
| `--text-base` | 16 px | body, input text (kept at 16 px on mobile so iOS does not zoom) |
| `--text-lg` | 18 px | `h2` section headings |
| `--text-xl` | 22 px | details panel title |
| `--text-2xl` | 28 px | stat values |
| `--text-3xl` | `clamp(2rem, 1.4rem + 2.4vw, 2.75rem)` | the single `h1` |

Line heights: headings `1.1` (`--leading-tight`), body `1.55` (`--leading-body`); all
unitless. Letter spacing: `-0.02em` on the `h1`, `+0.06em` (`--tracking-caps`) on
uppercase eyebrow and table-header labels, none elsewhere. Headings use `text-wrap:
balance`; descriptions, hints and notes use `text-wrap: pretty`. Long identifiers use
`overflow-wrap: anywhere`. Changing numbers (stat values, counts, timestamps, `.num`
cells) use `font-variant-numeric: tabular-nums`. Body copy is capped at `62ch`
(`.hero__lead`) and `70ch` (`.source-note`). Root has `-webkit-font-smoothing:
antialiased`. Map labels are SVG `<text>` sized in the component so they stay 12 px
(13 px for the centre label) on screen at any zoom.

## Layout

Spacing scale (`--space-1` … `--space-8`): 4, 8, 12, 16, 24, 32, 48, 64 px. Within a group
use 8–12 px; between groups 24–32 px (`.page` gap is 32 px, `.results` gap 24 px).

Content width: `.site-header`, `.page` and `.site-footer` share
`width: min(100% - 2 * var(--page-gutter), 72rem)` with `--page-gutter: clamp(1rem, 4vw,
2rem)`; everything aligns to that single left edge. Forms and prose are capped at `48rem`.

Grids and breakpoints (content-driven, in rem):

- Stats: `repeat(auto-fit, minmax(8.5rem, 1fr))`, which yields 2 columns at 320 px and 4
  columns from about 40 rem.
- Map and details: one column by default; from `62rem` (`@media (min-width: 62rem)`,
  `src/styles.css:784`) the `.map-layout` becomes `minmax(0, 2fr) minmax(18rem, 1fr)` with
  the details panel beside the map.
- Details facts: `repeat(auto-fit, minmax(7.5rem, 1fr))`.
- Every grid column is `minmax(0, 1fr)` and grid children get `min-width: 0`, so long
  addresses and the wide table never widen the page.
- The counterparty table has `min-width: 36rem` inside `.table-scroll`, a horizontally
  scrollable, `position: relative` container, so it scrolls within its card at narrow
  widths.
- The map stage is `clamp(20rem, 60vh, 40rem)` tall and `touch-action: none`, so one-finger
  drag pans the map; the page is scrolled from outside the stage.

Logical properties (`inset-inline-start`, `padding-inline`, `margin-inline-start`) are
used for direction-dependent spacing. Rendered widths checked in the browser: 320, 375,
820 and 1280 px, none with horizontal overflow. Widths between 820 and 1280 px and native
browser zoom were not checked.

## Elevation & depth

Three tonal layers: page (`navy-950`) → surface cards (`navy-900`) → raised elements inside
cards (`navy-800`). Cards (`.stat`, `.details`, `.constellation__stage`) add
`--shadow-raised` (`0 1px 0 rgba(255,255,255,.04) inset, 0 8px 24px rgba(0,0,0,.35)`) plus
a 1 px `--color-border`. The centre star and header mark use `--shadow-glow`
(`0 0 24px rgba(255,209,102,.25)`) and an SVG radial gradient. The map stage layers a
faint radial gradient over the surface. The fixed `.starfield` behind the page is built
from CSS radial gradients (three colour washes and twelve 1–1.5 px dots) and sits at
`z-index: -1` with `pointer-events: none`. There are no modals or overlays; the only
stacked element is the skip link at `z-index: 100`.

## Shapes

Radii: `--radius-sm` 6 px (copy buttons, code blocks, skeletons, row buttons),
`--radius-md` 10 px (inputs, buttons, banners, transaction rows), `--radius-lg` 16 px
(cards, map stage, table container; equals the 10 px inner radius plus a 6 px gutter),
`--radius-pill` for chips and badges. Stars are circles for wallets and 45° diamonds for
contracts; the same two shapes appear in the legend. Borders are 1 px; the focus outline
is 2 px with 2 px offset; the SVG selection ring is a 2 px on-screen stroke.

## Components

All styles live in `src/styles.css`; components are React function components with no
external UI library.

- **Buttons** (`.button`, `.button--primary`, `.button--ghost`, `.button--small`,
  `.button--link`; `.icon-button`): 44 px min height (36 px for `--small`, 40 px square
  for icon buttons), 600 weight, `scale: 0.96` on `:active`, 150 ms transitions on colour
  and scale only. One primary (filled accent) action per view: "Map activity". Labels are
  verb first and sentence case ("Try a sample", "Reset view", "Clear selection", "Show
  everything").
- **Address form** (`src/components/AddressForm.tsx`): visible `<label>`, monospace
  16 px input with `autocomplete="off"`, submit validation, `aria-invalid` +
  `aria-describedby` pointing at the inline `role="alert"` error, focus returned to the
  field; the submit button stays enabled until a request starts, then shows a spinner
  with its original label. The hint line doubles as the loading progress text.
- **Copy button** (`src/components/CopyButton.tsx`, `.copy-button`, `.copy-button--icon`):
  32 px tall, icon + "Copy" text (icon-only variant has a 44 px extended hit area via
  `::after`), states `idle | copied | failed` reflected in the label, icon, border colour
  and the shared live region. Falls back to `execCommand('copy')` when the Clipboard API
  is unavailable.
- **Announcer** (`src/components/Announcer.tsx`): one stable `role="status"` polite live
  region rendered once; `useAnnounce()` posts messages (load results, selection, copy).
- **Stat tile** (`src/components/StatsGrid.tsx`, `.stat`): `<dl>` card with uppercase
  13 px label, 28 px tabular value, 13 px muted detail; skeleton value while loading.
- **Filter chips** (`src/components/FilterBar.tsx`, `.chip`): real checkboxes inside a
  `<fieldset>` with legend "Show"; checked state shown by a filled swatch, coloured border
  and count; unchecked labels are struck through so state is not colour-only; focus ring
  drawn on the chip via `:has(:focus-visible)`. "Show everything" appears when any filter
  is off.
- **Constellation** (`src/components/Constellation.tsx`): SVG `role="group"` with an
  accessible name; each star is `<g role="button" tabindex="0" aria-pressed>` with an
  `aria-label` of name, type and interaction count and an invisible ≥ 44 px hit circle.
  Enter/Space toggles selection, Escape clears it, hover/focus/selection dims unrelated
  edges. Pan by pointer drag (including drags that start on a star), zoom by wheel
  (non-passive listener), pinch and the toolbar buttons; "Reset view" restores the camera.
  Labels for the 8 busiest stars are always shown. Empty states cover "no activity" and
  "no stars match these filters".
- **Details panel** (`src/components/NodeDetails.tsx`, `.details`): shows the centre
  wallet by default and the selected star otherwise, with the full address in a
  monospace block plus copy button, six facts, tokens moved, the latest 8 interactions
  (direction, time, amount, hash link + copy) and a "View … on Blockscout" link.
- **Counterparty table** (`src/components/CounterpartyTable.tsx`, `.table`): row header
  buttons select a star (`aria-pressed`), type badge, tabular sent/received counts, last
  seen, icon copy button; first 10 rows with an `aria-expanded` "Show all N
  counterparties" toggle.
- **Badges** (`.badge`, `--contract`, `--wallet`, `--danger`): 13 px pill outlines.
- **Banner** (`.banner--error`, `role="alert"`): title, plain message with the fix, and a
  "Try again" button for retryable errors.
- **Skip link** (`.skip-link`): first focusable element, targets `<main id="main">`.

## Motion

`--ease-standard: cubic-bezier(0.2, 0, 0, 1)`, `--duration-fast: 150ms`. Transitions name
their properties (`background-color, border-color, color, scale` on buttons; `opacity` on
edges and stars; `fill` on star bodies). The only keyframe animations are the 9 s
starfield twinkle, the 0.8 s spinner and the 1.4 s skeleton pulse, all inside
`@media (prefers-reduced-motion: no-preference)`; a reduce-motion block also collapses any
remaining transition to 0.01 ms. Hover fills are neutralised under `@media (hover: none)`.
Under `forced-colors: active` the chip swatches, legend dots and header mark keep their
authored colours; everything else follows system colours.

## Do's and don'ts

- Start a new section with `.page` width and gap, a `<section aria-labelledby>` with an
  `h2`, and cards built from `--color-bg-surface` + `--color-border` + `--radius-lg` +
  `--shadow-raised`.
- Put actions in `.button` variants: one `--primary` per view, `--ghost` for the rest,
  `.icon-button` for icon-only controls with an `aria-label`.
- Use the direction/contract hues only to encode direction or contract-ness. Do not use
  amber, mint or violet for decoration, and do not use the sky accent on non-interactive
  text.
- Keep control borders on `--color-border-strong`; `--color-border` alone is too faint to
  identify a control.
- Do not drop below 13 px text or 400 weight; keep inputs at 16 px.
- Do not add `outline: none`; rely on the global `:focus-visible` rule.
- Do not add a light theme, a second accent hue or new ramps without extending the
  semantic token list first.

Recipe for one more page or panel: wrap content in `<main id="main" class="page">`, add a
`section` card, use `.stat` for numbers, `.table-scroll > .table` for lists, `CopyButton`
next to any address, `useAnnounce()` for dynamic status, and keep the hash router
(`#query`) for any state that should be shareable.

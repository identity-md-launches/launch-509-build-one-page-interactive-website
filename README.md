# Wallet Constellation

A one-page, static website that turns the recent on-chain activity of any Ethereum
address into an interactive star map. Enter an address or ENS name; every counterparty
becomes a star, sized by how often it interacted with the wallet, and every line is a
transfer or contract call. Filters narrow the sky to outgoing, incoming or contract
activity, and a summary shows recent transactions, unique counterparties, contract
interactions and the most active day.

No wallet connection is involved. The site only reads public mainnet data and never asks
for private keys or signatures.

## How it works

- **Data source:** the public [Blockscout](https://eth.blockscout.com) Ethereum mainnet
  API v2, called directly from the browser (no API key, CORS enabled). The app fetches up
  to 4 pages of transactions (200) and 2 pages of token transfers (100) per address, so a
  map covers the most recent ~300 interactions. ENS names are resolved through the same
  API's search endpoint.
- **Sample data:** "Try a sample" loads a bundled snapshot of `vitalik.eth` from
  `src/data/sample.json`, so the map works offline and in tests.
- **Routing:** the query lives in the URL hash (`#0x…`, `#name.eth`, `#sample`), so a map
  is shareable and reloadable on any static host.
- **Stack:** Vite 6, React 19, TypeScript 5, plain CSS with custom properties. The
  constellation is hand-written SVG with pointer-based pan, wheel and pinch zoom.

## Install

Requires Node.js 20 or newer (built with Node 24.9 and npm 11.6).

```sh
npm install
```

## Preview during development

```sh
npm run dev
```

Vite serves the site with hot reload, normally at <http://localhost:5173>.

## Rebuild the static export

```sh
npm run build        # writes dist/
npm run preview      # serves the built dist/ locally
```

`dist/` is committed. Vite's `base` is `./`, so every asset URL in `dist/index.html` is
relative and the export works from a sub-path, an IPFS gateway or an ENS name without any
server-side rewrites. Rebuild and commit `dist/` after every source change; the publisher
serves the committed export and does not rebuild.

## Check the code

```sh
npm run typecheck    # tsc --noEmit
npm test             # vitest: unit tests for analysis, layout, formatting, the API
                     # client, and jsdom interaction tests for the app
npm run check        # typecheck + test + build
```

## Publish

The export is a plain static folder. Copy the contents of `dist/` to any static host:

- **Static hosting / CDN:** upload `dist/` as the site root (GitHub Pages, Netlify,
  Cloudflare Pages, S3, nginx). No rewrite rules are needed because the app uses hash
  routing.
- **IPFS / ENS:** `ipfs add -r dist` and point the ENS content hash at the resulting CID.
  Relative asset URLs keep the site working under `/ipfs/<cid>/`.

The site talks to `https://eth.blockscout.com` at run time, so the host must allow that
outbound request (it is a normal cross-origin `fetch`; no proxy is needed).

## Validation record

Commands run on the final source (2026-09-30, Node 24.9.0):

| Command | Result |
| --- | --- |
| `npm run typecheck` | passed, no errors |
| `npm test` | 5 files, 45 tests passed |
| `npm run build` | `dist/index.html`, `assets/index-*.js` (264 kB), `assets/index-*.css` (21 kB), `assets/sample-*.js` (159 kB, lazy) |
| Browser verification script (`test/scratch/browser-check.mjs`, headless Chromium via playwright-core, serving `dist/` under `/preview/`) | 59 of 59 checks passed |

The browser script exercised, at 1280×800, 820×1180, 375×812 and 320×640: page load under
a sub-path with no failed requests or console errors, the invalid-input error and focus
handling, loading the sample, all three filters and "Show everything", hover highlighting,
star selection by click, tap, keyboard (Tab, Enter, Escape) and from the counterparty
table, copy-to-clipboard with the live-region announcement, zoom buttons, wheel zoom, drag
panning (including drags that start on a star), reset view, expanding the table, a live
Blockscout fetch for a busy exchange address, live ENS resolution of `vitalik.eth`, the
network-failure alert with "Try again", horizontal-overflow checks, 24 px minimum target
sizes, 16 px input text on mobile, reduced-motion handling and rendered text contrast.
Screenshots are in `artifacts/screenshots/`; the full design review is in
`artifacts/validation.md` and the design system in `DESIGN.md`.

Known limitations:

- Internal (contract-to-contract) transactions are not part of the map; Blockscout's
  address transaction feed does not include them.
- Only the most recent ~300 interactions are analysed. Older history is not fetched.
- Blockscout's public API is rate limited. Repeated rapid lookups can return HTTP 429; the
  app reports this and offers a retry.
- No screen-reader session, physical-device test or native 200 % browser zoom was run.
  See `artifacts/validation.md`.

## Project layout

```
index.html              Vite entry
src/main.tsx            React bootstrap
src/App.tsx             Page shell, data loading, hash routing, filters
src/components/         AddressForm, StatsGrid, FilterBar, Constellation (SVG map),
                        NodeDetails, CounterpartyTable, CopyButton, Announcer
src/lib/blockscout.ts   Blockscout API client and normalisation
src/lib/analyze.ts      Filters, graph aggregation, statistics
src/lib/layout.ts       Deterministic constellation layout
src/lib/format.ts       Address, amount and date formatting
src/data/sample.json    Bundled sample snapshot
src/styles.css          Design tokens and all styles
dist/                   Committed production export
artifacts/              Validation report and screenshots
```

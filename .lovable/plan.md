## Why "1000% conf"
`confidence` is a 0–10 integer. The card renders it with a `%` suffix and no division, so `10 → "1000%"`. Replaced entirely by a 5-bar Signal Strength indicator + `{confidence}/10` label.

**Constraints**
- Frontend only. No edge functions, migrations, or data-shape changes.
- Zero "AI" wording in UI copy. Use "Automated Intel" / "Signal Strength" / "Proprietary Data".
- Brand teal `#00d4ff`, navy `#0a1628`. Tailwind tokens only.

---

## Files touched
- `src/components/radar/RadarFitCard.tsx` — presentation rewrite (data wiring untouched).
- `src/components/radar/LeadDetailDrawer.tsx` — tabs → accordion + responsive bottom-sheet.
- `src/components/radar/SignalStrengthBars.tsx` — **new**, 5-bar component.
- `src/components/radar/DossierPrintSheet.tsx` — **new**, print-only A4 layout.
- `src/index.css` — halo `@keyframes`, gradient-fade utility, `urgency-pulse`, `dossier-print` print scope.
- `src/assets/dwa-mark.svg` — **new** if absent (reuse `public/demo-logos/djc-shield.svg` styling).

No package additions. `Accordion` and `Drawer` (vaul) primitives already in `src/components/ui/`.

---

## Phase A — `RadarFitCard.tsx`

1. **Signal Strength bars** (replaces `1000% conf` bug). New `<SignalStrengthBars value={confidence} />` — 5 vertical bars filled by `Math.round(confidence/2)`. Color: red `0–4`, amber `5–6`, teal `7–8`, emerald `9–10`. Trailing `{confidence}/10` micro-label.
2. **Urgency pulse** — if `detected_at` within 24 h, the date label gets `urgency-pulse` class (teal box-shadow keyframe, 2 s loop). No red — red reads as error.
3. **Compact 2-line header** — row 1: signal-type chip + Next-action chip + Signal Strength bars. Row 2: company name (bold) · industry · city · hiring count.
4. **Gradient-fade "Why"** — first 140 chars of `fit_reason`, CSS `mask-image: linear-gradient(...)` fades last 24 px to `#0a1628`. Trailing `Read more →` button toggles full text.
5. **Collapsed body** — visible by default: header, Why (faded), Revenue × Window pill row. Hidden behind `Show details ▾`: opener, objection, predicted needs, source links.
6. **Editorial pull-quote** — opener uses `font-serif`, left rule `border-l-2 border-[#00d4ff]/60`, subtle indent. No italics, no quotes auto-curled.
7. **Hot halo** — `fit_score ≥ 75` adds a `::before` ring with `conic-gradient` rotating 6 s linear infinite (single brand palette, no industry branching).
8. **DWA watermark** — when hot, `<img src={dwaMark}>` absolute `top-3 right-3 w-12 h-12 opacity-[0.05] pointer-events-none`.
9. **Haptic depress** — entire card gets `active:scale-[0.98] transition-transform duration-150`.
10. **No fabricated scarcity** — *"X contractors viewing" deferred until real `signal_views` table exists. Building fake counts is FTC risk — rejected.*

Keep `OutreachActionBar` mounted (Call/Email/LinkedIn already wired).

---

## Phase B — `LeadDetailDrawer.tsx`

11. **Responsive shell** — `useIsMobile()` hook (already in `src/hooks/use-mobile.tsx`). Mobile (`< 768 px`) → `Drawer` (vaul, swipe-down). Desktop → `Sheet side="right"`. Identical body component shared.
12. **Accordion sections** — `<Accordion type="single" collapsible defaultValue="dossier">` with items: Dossier, Outreach, Contacts, Intel. Smooth `accordion-down` keyframes (already in tailwind config).
13. **Sticky action header** — pinned `top-0` bar with Call · Email · Copy-link · **Send to CRM** (primary teal). "Send to CRM" calls existing `crm-webhook` push helper with the lead. *No "Claim Lead" button — these aren't marketplace leads, that wording would mislead.*
14. **Segmented Outreach** — three-way segmented control (Email / SMS / LinkedIn). Active draft renders in a single panel with **Copy** button → `sonner` green toast `"Copied to clipboard"`.
15. **Favicon citations** — each source URL prefixed with `<img src={`https://s2.googleusercontent.com/s2/favicons?domain=${hostname}&sz=32`} className="w-3.5 h-3.5">`, hostname (truncated 28 ch), opens `target="_blank" rel="noopener noreferrer"`.
16. **Predicted needs as chips** — clean teal-outline chips with the need label. (Count suffix omitted — data shape doesn't carry per-need counts; faking would be dishonest.)
17. **Intel/Contacts mini-buttons** — leading colored icon block, label + sublabel, trailing `Open ↗`. Strict `rel="noopener noreferrer"`.
18. **Skeleton hydration** — while `radar-fit-explainer` resolves, render Dossier skeleton matching final layout (header strip, fit pill, 2-line summary, revenue/window grid). Uses `<Skeleton>` from `src/components/ui/skeleton.tsx`.
19. **Trust footer** — single line: `Flag incorrect data →` opens `mailto:matt@detroitwebagent.com?subject=Incorrect data: {company}&body={lead URL}`. *No "refunds available" claim — only ship when there's a real policy.*
20. **Keyboard polish** — `Esc` closes (Sheet/Drawer native), tab order: header actions → accordion triggers → first action of open section → footer link. Visible focus ring `ring-2 ring-[#00d4ff] ring-offset-2 ring-offset-[#0a1628]`.

**Rename to remove "AI"** — `AI-recommended angle` → `Automated Intel`. `Analyzing fit for…` → `Reading signal strength for…`.

---

## Phase C — Print to PDF

- New `<DossierPrintSheet />` rendered inside drawer, hidden screen / visible print:
  - Header: DWA logo + "Lead Dossier" + generated date.
  - Body: Company, signal type, signal strength, location, industry, predicted needs, full opener, full source URLs.
  - Footer: QR code placeholder box (`<div class="qr-placeholder">`) — empty 80×80 px box with `Scan to reopen` caption. Real QR generation deferred (no library install in this sprint).
- "Save as PDF" button in Dossier accordion header → `window.print()`.
- `@media print` in `src/index.css`:
  ```
  body * { visibility: hidden; }
  .dossier-print, .dossier-print * { visibility: visible; }
  .dossier-print { position: absolute; inset: 0; padding: 1cm; color: #111; background: #fff; }
  @page { margin: 1.2cm; size: Letter; }
  ```

---

## Verification
- Build passes (auto).
- Manual: `/my-demand-radar` and `/my-buyer-radar` at 396 px (current viewport) and 1280 px.
- Click each card button + each drawer link + Save as PDF.
- Confirm no string `% conf` and no string `AI` anywhere in rendered radar UI.
- Toast fires on Copy. CRM button posts (network tab).

## Deferred for a future ticket (intentionally not in this sprint)
- Real `signal_views` counter table → live "watching now" badge.
- Real QR code generation (needs `qrcode` package install).
- Refund policy copy — only after Matt confirms terms.

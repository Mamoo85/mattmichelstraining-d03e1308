# AD_CREATIVE_PROTOCOL.md

Single source of truth for building DWA/M2 ad animations. Every new ad starts here.

---

## Format

| Property | Value |
|---|---|
| Scene size | 390 × 844 px (9:16 vertical — Meta Reels / TikTok / Instagram Stories) |
| Background | Dark (`#0a0a0a` or brand-appropriate near-black) |
| Phone frame | 330 × 714 px, centered in scene, `border-radius:44px`, inner bezel + shadow |
| Dynamic Island | 120 × 34 px, top-center of phone |
| Font | `-apple-system,'SF Pro Display','Helvetica Neue',sans-serif` |
| Loop | Auto-loop every 18–24 s with 800 ms black gap |

---

## Beat Structure (4 beats, never more than 5)

| Beat | Duration | Purpose | What to show |
|---|---|---|---|
| 0 — Hook | 0–3 s | Stop the scroll | Bold text overlay, NO phone visible, ONE pain point |
| 1 — Problem/Demo | 3–8 s | Show the pain or the "before" state | Phone appears, product demo begins |
| 2 — Resolution | 8–14 s | Show it working, lead replies, job booked | Key visual payoff moment |
| 3 — CTA | 14–20 s | Brand + offer | Full-screen final card with button |

---

## Text Size Rules (MINIMUM — go bigger if it fits)

| Element | Min size | Notes |
|---|---|---|
| Hook headline | 48–60 px, weight 900 | First line on screen, darkest background |
| Hook accent line | 44–52 px | Color callout (red for pain, brand color for benefit) |
| Phone UI labels / names | 18–20 px | Lead names, app titles |
| Phone body text / bubbles | 16–18 px | Message bubbles, descriptions |
| Tags / badges | 13–14 px, weight 700 | "Exclusive", "Urgent", distance |
| Caption bar text | 24–28 px, weight 800 | Never below 24 px |
| Final CTA title | 40–46 px, weight 900 | Should be readable as thumbnail |
| Final sub / price | 16–18 px | Muted color |

---

## Caption Bar Rules

- Position: `top: 48–52%` of the **phone element** (vertical center of screen — not bottom)
- Style: `background:rgba(0,0,0,.78); border-radius:14px; padding:14px 20px`
- One caption per beat — swap text at beat transitions, never stack two
- Use `<em>` for the key word in green or yellow: `cap-txt em { color:#ffd60a; font-style:normal; }`
- Hide the caption during transitions (call `cap('', false)` before switching screens)

---

## Color System

| Use | Value |
|---|---|
| Pain / danger / competitor | `#ff3b30` (iOS red) |
| Success / exclusive / accept | `#34c759` (iOS green) or brand color |
| Trust / CTA button | `#0a84ff` (iOS blue) |
| DWA blue | `#007aff` |
| Trade Radar green | `#2ecc71` |
| Warning callout | Yellow badge `#ffd60a` |
| Muted labels | `rgba(255,255,255,.45)` on dark |

---

## Animation Patterns

```css
/* Standard fade-in with spring bounce */
.element {
  opacity:0; transform:translateY(20px);
  transition:all .5s cubic-bezier(.34,1.2,.64,1);
}
.element.in { opacity:1; transform:translateY(0); }

/* Pop (checkmark, badge) */
.element { transform:scale(0); transition:transform .5s cubic-bezier(.34,1.56,.64,1); }
.element.pop { transform:scale(1); }

/* Slide in from right (lead cards) */
.lead-card { opacity:0; transform:translateX(24px); transition:all .45s cubic-bezier(.34,1.1,.64,1); }
.lead-card.in { opacity:1; transform:translateX(0); }

/* Screen swap */
.screen { position:absolute; inset:0; opacity:0; transition:opacity .4-.6s ease; }
.screen.visible { opacity:1; }
```

---

## Existing Reference Ads

| File | Product | Key visual hook | Special technique |
|---|---|---|---|
| `ad-creatives/missed-call-catch-v2.html` | Missed-Call Catch | "You missed a call. They hired your competitor." | Incoming call → missed → auto-text fires → lead replies |
| `ad-creatives/trade-radar-v2.html` | Trade Radar | "Stop buying shared leads. Get yours. Only yours." | Lock screen push notification → app with lead cards → accept → auto-text confirm |
| `ad-creatives/website-packages-v2.html` | Website Packages | "Your website is losing you money." | Before phone (loading bar, ugly site) → wipe to after (clean modern site) → out-of-phone final card |
| `ad-creatives/contractor-leads-v1.html` | Contractor Leads | "Angi just sent your lead to 5 other guys." | Full-scene split card (Angi vs DWA) — no phone in this beat |

---

## File Naming

```
ad-creatives/{product-slug}-v{n}.html
```

Examples: `missed-call-catch-v2.html`, `trade-radar-v3.html`, `m2-elite-v1.html`

Always increment `v` — never overwrite a previous version.

---

## QC Protocol (Playwright)

Screenshots go in `ad-creatives/qc-{file-basename}-{beat}.png` (gitignored).

```js
// playwright qc script pattern
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 390, height: 844 });
await page.goto('file:///path/to/ad.html');

// Capture each beat at the right timestamp
await page.waitForTimeout(1500); // hook
await page.screenshot({ path: 'qc-hook.png' });
await page.waitForTimeout(3000); // demo
await page.screenshot({ path: 'qc-demo.png' });
// ... etc
await browser.close();
```

Read each screenshot with the vision tool. Look for:
- Hook text visible from thumbnail distance (arm length)
- Caption bar at vertical center (not buried at bottom)
- Lead names / bubbles readable without zooming
- No black frames during key beats (adjust `waitForTimeout` if needed)

---

## Build Checklist

Before pushing a new ad:

- [ ] Hook text ≥ 48 px, weight 900, readable on dark background
- [ ] First beat lands in < 1.5 s on screen
- [ ] Caption bar is at `top: 48–52%` of phone, not at bottom
- [ ] All phone UI text (names, bubbles) ≥ 16 px
- [ ] Final CTA card has: logo, product name (≥ 40 px), one-line sub, stat box, CTA button, price
- [ ] Animation loops cleanly (all `.visible` and `.in` classes removed on reset)
- [ ] QC screenshots reviewed with vision tool
- [ ] File follows naming convention `{product}-v{n}.html`

---

## What Needs a Talking Head (HeyGen)

These formats require a talking head — use HeyGen for all of them. Do NOT build HTML for these:

- UGC testimonial ("I used to lose leads every day…")
- Transformation before/after for M2 Training
- "Phone-shot" demo walkthroughs with voiceover
- Any ad where the hook is a person speaking to camera

HTML animation is for **screen recording style** ads only (app demos, phone UI, split comparisons).

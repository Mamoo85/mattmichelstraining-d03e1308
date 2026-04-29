# D.J. Conley Pitch Kit — Over-The-Top Edition

Goal: turn the Thursday meeting into a "wow, you built this just for us" moment. Three deliverables: (1) the demo page polish you asked for, (2) a 20-second cinematic Remotion sizzle reel that auto-plays the missed-call story above the fold, (3) a reusable JSON-driven demo template so every future pitch is a 5-minute swap.

## 1. DJConleyDemo2.tsx — Required Polish

**Address swap (Warren → Troy)**

- Line 28: `Warren` → `Troy` for James P. (boiler op).
- Line 215: `"emergency boiler repair Warren MI"` → `"emergency boiler repair Troy MI"`.
- Line 274: `Available right now near Warren:` → `Available right now near Troy:`.
- ZIP `48091` is not currently in the file but I'll grep again at build time; any hit gets `48083`.

**Today timestamps in SiteRadar**

- Line 7: `"14 min ago"` → `"Today, 2:14 PM"` (Stellantis).
- Line 8: `"1h 22m ago"` → `"Today, 11:47 AM"` (DMC).
- Line 9: `"2h 51m ago"` → `"Today, 9:03 AM"` (Wayne County Schools).
- Line 103 narrative: `"14 minutes ago"` → `"at 2:14 PM today"` to stay consistent.

**New panel: After-Hours Emergency Lead Capture — $99/mo** (inserted right after the SiteRadar block, before Dispatch toggle)

- Dark card matching existing theme (`#0a1628` bg, `#dc2626` accent border to signal emergency).
- Left: phone-frame mockup (rounded rect, notch, status bar showing `2:34 AM`).
  - Bubble 1 (incoming, gray): "📞 Missed Call from (586) 555-0142 · 2:34 AM"
  - Bubble 2 (outgoing teal, 30s later, animated fade-in): "Got your voicemail! Our emergency boiler team will call back within 15 min. —D.J. Conley"
  - Subtle pulse on the missed-call bubble; outbound bubble slides up after a 600ms CSS keyframe delay (one-shot, not infinite — playable in static screenshot too).
- Right: copy block — "Every missed emergency call is a competitor's gain. Missed-Call Catch fires an auto-text in under 60 seconds, 24/7." + 3 mini-stats (Avg response time `< 60 sec`, Coverage `24/7/365`, Recovery rate `~38% of missed callers convert`).
- Footer line: `+ $99/mo · Pairs with FieldDesk · Uses your existing forwarding number`.

**Kiosk mode (`?kiosk=1`)**

- `useEffect` on mount reads `new URLSearchParams(window.location.search).get('kiosk')`.
- If `1`: add `kiosk-mode` class to root div, set `document.documentElement.style.overflow = 'hidden'` and same on `body`, hide the in-page `<header>` (top nav with the DWA branding strip), and bump max-width from 1100 → 1280 so it fills the 24" portable monitor edge-to-edge.
- Cleanup on unmount restores overflow.
- Inject a small `<style>` block: `.kiosk-mode header { display: none !important }` plus a fade-in on the whole page so it feels intentional when you flip to it.

## 2. The Sizzle Reel — Remotion video (THE wow moment)

A 20-second cinematic MP4 that plays muted, looped, autoplay above the SiteRadar panel only in kiosk mode. This is what makes Pat go "holy shit." Built with Remotion, rendered to `/mnt/documents/djconley-sizzle.mp4`, then copied into `public/videos/djconley-sizzle.mp4` and embedded with `<video autoPlay muted loop playsInline>`.

**Storyboard (30fps · 600 frames · 1920×1080):**

- 0–60f: Black. White type fades in: "2:34 AM · Tuesday." Subtle clock tick sfx-style typography.
- 60–150f: Phone frame slides up from bottom. "📞 Incoming — Boiler Down · Stellantis Warren Truck Plant" pulses red. Camera pushes in.
- 150–240f: Call ends unanswered. Screen dims. Type overlay: "Voicemail received." Then a counter starts: `00:01 → 00:30` — the 30-second gap.
- 240–330f: Outbound SMS bubble slides in with the D.J. Conley auto-reply. Teal glow. Type-on cursor effect on the message body.
- 330–420f: Cut to a competing contractor's phone — also ringing at 2:34 AM, no auto-text. Screen stays dark. Big red type: "They went silent. Pat won the job."
- 420–540f: Dashboard cinematic — the SiteRadar visitor list animates in line-by-line over a parallax of the dispatch board. "$1,400 emergency call · captured."
- 540–600f: End card. DWA logo + "Missed-Call Catch · $99/mo · 24/7." Fade.

**Tech notes:**

- Brand palette: `#dc2626` red, `#00d4ff` teal, `#0a1628` near-black, white. No purples/cyans.
- Typography: Inter (already supported in Remotion via google-fonts).
- All motion via `useCurrentFrame` + `interpolate`/`spring`. `<TransitionSeries>` with `wipe` and `fade` between scenes.
- Uses the project's existing `remotion/` directory — adds `src/scenes/MissedCallSizzle/` with 5 scene files + persistent layer.
- Render headless via `node scripts/render-remotion.mjs` (already wired).
- Final MP4 ~2 MB H.264, copied to `public/videos/djconley-sizzle.mp4` so `<video src="/videos/djconley-sizzle.mp4">` works without a CDN.
- Kiosk mode shows the video at top in a `border: 1px solid #1e3a5f`, `borderRadius: 16`, `aspectRatio: 16/9` frame with a subtle "▶ LIVE DEMO" overlay tag.

## 3. Reusable Demo Template — `/demo/:slug`

`**src/pages/DemoTemplate.tsx**`

- `useParams()` to get `slug`, dynamic-import `src/data/demoConfigs/${slug}.json`. Gracefully 404s with a "Demo not found" panel.
- Renders the same layout as DJConleyDemo2 but every string + array is config-driven.
- Inherits kiosk mode + sizzle reel slot (config can specify `sizzleVideoSrc` — falls back to no-video).

**Config shape (`src/data/demoConfigs/djconley.json`):**

```json
{
  "companyName": "D.J. Conley Associates",
  "industry": "Boiler Service",
  "tagline": "Field Operations Command Center",
  "accentColor": "#00d4ff",
  "alertColor": "#dc2626",
  "logoEmoji": "🔥",
  "city": "Troy",
  "state": "MI",
  "zip": "48083",
  "currentSiteUrl": "djconley.com",
  "fakeVisitors": [
    { "company": "Stellantis Facilities Mgmt", "page": "Boiler Tune-Up Services", "time": "Today, 2:14 PM", "badge": "🏭", "value": "$40k–$120k contract" },
    { "company": "Detroit Medical Center", "page": "Service Contracts", "time": "Today, 11:47 AM", "badge": "🏥", "value": "$25k–$60k contract" },
    { "company": "Wayne County Schools", "page": "Homepage", "time": "Today, 9:03 AM", "badge": "🏫", "value": "$15k–$35k contract" }
  ],
  "stats": { "jobsToday": 7, "techsInField": 4, "openRevenue": "$34,200", "reviewScore": "4.8" },
  "yearOneSavings": "$14,412",
  "candidates": [
    { "name": "James P.", "license": "1st Class Boiler Op", "city": "Troy", "score": 9, "source": "State licensing records" },
    { "name": "Kevin M.", "license": "2nd Class Boiler Op", "city": "Sterling Heights", "score": 7, "source": "Proprietary OSINT" }
  ],
  "products": ["fielddesk", "siteradar", "techalert", "missedcall"],
  "competitorPricing": [
    { "name": "FieldServio", "price": "$1,400/mo", "note": "Built for forklift rental companies" },
    { "name": "eWay-CRM", "price": "$300–400/mo", "note": "An Outlook plugin. For desk workers." }
  ],
  "ourPrice": { "name": "FieldDesk", "price": "$199/mo", "note": "Unlimited users. Built for boiler rooms." },
  "sizzleVideoSrc": "/videos/djconley-sizzle.mp4"
}
```

**Routing (`src/App.tsx`):**

- Add `const DemoTemplate = lazyRetry(() => import("./pages/DemoTemplate"));`
- Add `<Route path="/demo/:slug" element={<DemoTemplate />} />` near the other demo routes.
- Keep `/demo-djconley-2` intact (legacy bookmark).

**Future workflow:** for the next pitch you drop a new JSON file + (optional) custom sizzle reel and the URL `/demo/{slug}?kiosk=1` is live.

## Files Touched


| File                                              | Action                                                                    |
| ------------------------------------------------- | ------------------------------------------------------------------------- |
| `src/pages/DJConleyDemo2.tsx`                     | edit — Troy, timestamps, Missed-Call panel, kiosk mode, sizzle video slot |
| `remotion/src/Root.tsx`                           | edit — register MissedCallSizzle composition                              |
| `remotion/src/scenes/MissedCallSizzle/index.tsx`  | new — main composition                                                    |
| `remotion/src/scenes/MissedCallSizzle/Scene*.tsx` | new — 5 scene files                                                       |
| `public/videos/djconley-sizzle.mp4`               | new — rendered output                                                     |
| `src/pages/DemoTemplate.tsx`                      | new — config-driven template                                              |
| `src/data/demoConfigs/djconley.json`              | new — seed config                                                         |
| `src/App.tsx`                                     | edit — `/demo/:slug` route                                                |


## Verification Checklist (before Thursday)

1. `/demo-djconley-2?kiosk=1` — no nav, no scroll bars, sizzle video autoplays muted, all panels visible on a 1920×1080 monitor without horizontal scroll.
2. Address shows **Troy, MI 48083** everywhere (script-grepped).
3. SiteRadar timestamps say **Today, [time]**.
4. Missed-Call panel: phone mockup renders, outbound SMS animates in once on load.
5. Sizzle MP4 file exists at `public/videos/djconley-sizzle.mp4`, < 5 MB, plays in Safari iOS (`playsInline`).
6. `/demo/djconley?kiosk=1` renders identically to the hand-coded page.
7. `/demo-djconley-1` (existing) still works (untouched).

## Open Questions (low-stakes — I'll default if no reply)

- Sizzle reel length: 20s loops cleanly. If you'd rather it be 30s with an extra "dispatch board comes alive" beat, say so. 30s sounds good. 
- Sizzle audio: muted by default for autoplay. I can render a version with subtle UI sfx (notification ping, swoosh) for if you tap to unmute — adds ~30 min render time. Default = muted only. What do you recommended? 
- Kiosk mode: should the "back to normal" be `?kiosk=0` or just removing the param? Default = remove the param (simpler).
- This needs to be a billion dollars looking. 
- Do not mess this up. Test everything. Make sure I have a start demo button so I can get into the kiosk when I need to. 
- This should be amazing. 
- Doesn't dj Conley need demand radar or buyer radar? We can't offer anything sense? 
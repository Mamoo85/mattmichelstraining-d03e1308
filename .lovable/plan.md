

## Plan: 4 SMS Inbox Quality-of-Life Upgrades

All changes live in **one file**: `src/components/dwa-admin/AdminSMSInbox.tsx`. No DB changes, no edge functions, no new files.

---

### 1. Quick-action chips in the composer

Add a horizontal scrolling strip of **chip buttons** directly above the composer pill (visible on every thread, not just unknown contacts). Each chip is a one-tap insert from a curated subset of `ONBOARDING_FAQ` — the 4–5 highest-frequency replies:

- **⏰ Availability** — "I'll get back to you within the hour — usually faster. — Matt | (313) 992-1219"
- **💵 Pricing** — pulls the existing "How much / what's the price?" answer
- **🔗 Booking link** — "Grab a slot here: detroitwebagent.com/book — pick anything that works."
- **📋 Full pitch** — pulls the long-form "🔥 Full pitch" entry already in `ONBOARDING_FAQ`
- **♻️ Refund** — pulls the existing "Refund / guarantee?" answer

New constant `QUICK_ACTIONS` (built from existing `ONBOARDING_FAQ` entries + 2 new short ones for availability and booking link). Tap = `setDraft(answer)` + focus the textarea. Renders as a single-row `overflow-x-auto` strip with `text-[11px]` pill chips so it doesn't eat vertical space on the 396px viewport. Hidden during compose mode (only shows in active-thread mode).

---

### 2. Persist `inboundOnlyMode` in localStorage

- Initialize state from localStorage: `useState(() => safeLocalStorage.getItem("dwa_sms_inbound_only") !== "false")` — defaults to `true` (inbound-only) on first visit.
- Add a `useEffect` that writes the value to localStorage whenever it changes: `safeLocalStorage.setItem("dwa_sms_inbound_only", String(inboundOnlyMode))`.
- Use the existing `safeLocalStorage` helper from `@/lib/browserStorage` (already in the project) so it doesn't crash in private mode.

Result: toggle survives refresh, tab close, and navigation away/back.

---

### 3. Fix bubble grouping for outbound runs in "Show all" mode

Today's render block (lines 689–765) already handles run grouping correctly for both directions in terms of bubble corner shaping and timestamp-on-last-in-run. The actual bug is in the **avatar rendering** (lines 720–725): only the inbound side gets an avatar slot, and outbound bubbles have no leading-edge avatar (which is correct for IG style) but **outbound runs lose the "you" identifier when the conversation starts with outbound** in "Show all" mode.

Fix:
- Add a tiny right-side "you" badge (a 6×6 cyan dot or "M" initial circle) on the **last bubble of each outbound run**, mirroring the inbound avatar pattern. Hidden mid-run (opacity-0), visible on `isLastInRun`.
- Ensure `isFirstInRun` / `isLastInRun` work correctly when `inboundOnlyMode === false` and the thread starts with outbound — the calc is already direction-agnostic but the visual avatar slot is not. Adding the right-side avatar fixes the asymmetry.
- Also ensure the **day separator** (line 699) resets the run — currently a same-direction message that crosses midnight still shows `sameSenderAsPrev = true` and tightens spacing inappropriately. Fix: `const sameSenderAsPrev = prev && prev.direction === m.direction && !showDay;` (and the same guard on `sameSenderAsNext` against the next-day boundary).

This makes outbound-only or outbound-starting threads render with proper visual structure when "Show all" is on.

---

### 4. Accurate per-thread unread counts + auto-mark-read

The current logic (line 253–255) only counts inbound messages not in `readSet()`, which is correct — but the auto-mark-read effect (lines 383–390) fires on **every** `threads.length` change, which means unread badges flicker and sometimes mark threads read that weren't actually opened.

Fixes:
- **Per-thread read tracking is already inbound-message-keyed** (good — outbound never counted as unread). Keep this.
- **Tighten the mark-read effect** to only fire when `activePhone` actually changes (depend on `activePhone` only, not `threads.length`). Look up the active thread's messages inside the effect via a fresh `threads` ref so we don't miss new inbound messages that arrive while the thread is already open.
- **Mark-on-arrive**: add a second small effect that marks any new inbound message read **if its thread is currently active** when realtime delivers it. Today, an open thread's badge briefly shows "1 new" until `loadInbox` recomputes — this fix marks it read instantly.
- **Inbound-only filter compatibility**: when `inboundOnlyMode === true`, hidden outbound-started threads still have their inbound messages counted in `totalUnread`. Fix: `totalUnread` should sum across the **filtered** `threads` array (which it already does — but verify the filter is applied before reduce; today it is, no change needed). Add a tooltip to the unread chip: "X unread across visible threads".
- **Sticky read state across refresh**: `readSet()` already uses localStorage — no change needed, but cap the stored set at the most recent 5,000 IDs to prevent unbounded growth (prune on write).

Result: badge counts match what's actually unread in the current view, opening a thread clears its badge instantly, and new inbound messages mark themselves read if the thread is already on screen.

---

### Files touched
- **EDITED**: `src/components/dwa-admin/AdminSMSInbox.tsx` (~80 LOC change across 5 spots)

### What stays the same
- All DB queries, realtime channel, 20s poll, send flow, AI draft, ResendSmsModal, contact-label cross-reference, "skip Matt's personal cell" filter, mobile back button, Instagram-style layout, day separators.

### What you'll feel after
- Tap a chip to drop a canned reply in 1 second instead of opening the cheatsheet sheet
- Refresh the page → still on Inbound only (or Show all if you flipped it)
- Toggle Show all → outbound-only threads render with proper avatars, run grouping, and timestamps just like inbound ones
- Thread badge clears the instant you open it; new texts arriving while you're already in the thread don't blip a "1 new" badge


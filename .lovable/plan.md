

## Reimagine SMS Inbox — Instagram-Style DM Layout, Inbound-First Filter

### What's wrong today (from your screenshot)

1. **Message bubbles are huge** — `text-sm` (14px) bubbles stack vertically with `space-y-2`, eating ~75% of the right pane. On your 396px viewport one message fills the screen.
2. **Reply box is tiny** — `<textarea rows={3}>` with default font size, so it shows ~3 lines max while a single bubble shows 4+ lines.
3. **Outbound-only threads dominate the list** — every cold drip / web-design pitch you've sent shows as a "thread" even though that person never wrote back. That's why your inbox is full of `(313) 562-7625 · You: Matt Michels again…` with no reply ever coming.
4. **Header eats vertical space** — `(313) 992-1219 · last 30 days · unread` chip + h2 + outer page padding wastes ~120px before the conversation even starts.

### The fix — 3 changes

**1. Filter rule: only show threads where THEY texted first**
- After building the `Map<phone, Message[]>`, drop any thread whose **earliest** message is `direction === "outbound"`.
- Result: inbox only shows real two-way conversations + true cold inbounds. All your one-way blast history disappears from this view.
- A small toggle at the top (`Inbound only ▾ | Show all`) lets you flip back to the old "everything I've sent" view if you ever need to find an outbound message — defaults to **Inbound only**.

**2. Instagram-style DM layout (mobile-first, dense)**
Reference: Instagram DM, iMessage, WhatsApp Web. All share the same proportions:
- Tight bubbles: `text-[13px] leading-snug px-3 py-1.5 rounded-2xl` (not `rounded-lg`)
- Bubble max width `max-w-[78%]`, tight `space-y-1` between consecutive same-sender bubbles, `space-y-3` between sender changes
- **Group consecutive bubbles** from the same sender — only show the timestamp under the LAST bubble of a run, not under every bubble (this alone reclaims ~40% vertical space)
- Avatar/initial circle next to each inbound run (first bubble only)
- Sticky compact header: just `display name + 📞` in a 44px bar (was 76px)
- Day separators: `Today`, `Yesterday`, `Apr 21` pills centered between message groups
- Auto-scroll pinned to bottom on thread open (already wired)

**3. Bigger, smarter composer**
- Composer row pinned to bottom of conversation pane, rounded pill input (Instagram-style), `min-h-[44px] max-h-[160px]` auto-grow textarea — starts as ONE line, grows up to ~6 lines as you type
- Send button = circular icon button on the right side INSIDE the pill (not a separate row)
- Char counter + "From (313) 992-1219" moves to a `text-[10px]` micro line ABOVE the input, only visible when focused or `draft.length > 100`
- 🤖 Draft button collapses into a small chip to the left of the input (icon only on mobile, "🤖 Draft" on desktop)
- Onboarding cheatsheet stays but auto-collapsed; opens as a bottom sheet that overlays the conversation rather than pushing the composer up

### Visual proportions (target on 396px viewport)
```
┌──────────────────────────────┐
│ ← (734) 620-7178      📞    │ 44px header
├──────────────────────────────┤
│                              │
│  ┌──────────────┐           │
│  │ inbound      │           │  ~580px conversation
│  └──────────────┘           │  (was ~360px)
│                              │
│           ┌──────────────┐  │
│           │ outbound     │  │
│           └──────────────┘  │
│                              │
├──────────────────────────────┤
│ 🤖 [type a message…]    ⬆️ │ 52px composer
└──────────────────────────────┘
```
Currently composer + header take ~280px of a 762px screen. Target: ~96px combined.

### Files touched

- **EDITED**: `src/components/dwa-admin/AdminSMSInbox.tsx`
  - Add `inboundOnlyMode` state (default `true`) + toggle in header
  - In `loadInbox()`: after building thread map, filter `messages[0].direction === "inbound"` when toggle is on
  - Rewrite the conversation render block: bubble grouping, day separators, tighter typography
  - Replace the bottom textarea block with the auto-grow pill composer
  - Slim down header (remove "last 30 days" subline; keep unread chip inline with title)

No DB changes. No edge function changes. No new files. ~150 LOC change in one component.

### What stays the same
- `system_comms_log` query, realtime channel, 20s poll, `dwa-send-sms` invoke, AI draft button, ResendSmsModal, onboarding cheatsheet content, contact-label cross-reference, "skip Matt's personal cell" filter, mobile back button.

### What you'll see after
- Inbox list drops from ~30 threads (mostly your own outbound blasts) to ~5–10 real two-way conversations
- The (734) 620-7178 thread you have open will show ~6–8 message bubbles on screen instead of 2.5
- Typing area is the right size — composer takes ~50px instead of ~140px
- Looks/feels like Instagram DMs


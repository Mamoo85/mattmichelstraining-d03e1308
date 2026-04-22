

## Reimagine: LinkedIn Blitz → "Growth Signal Outreach" with Real Pitch Clarity

### What's actually happening (and why the message is confusing)

The McKinley Mechanical card you circled is from `AdminLinkedInBlitz.tsx`. Here's the truth:

1. **The data is real.** `industry_pulse_signals` is your **Supply Radar** scanner — it watches BSEED permits + job postings and flags Metro Detroit companies that are *expanding* (a contractor pulling 8 HVAC permits + posting jobs = they're about to spend on HVAC equipment in the next 30–60 days).

2. **The pitch the AI built is wrong for that data.** The current copy ("free sample dossier", "I track Detroit-area manufacturers", "found 42 of these this week") is pitching **Supply Radar** ($199/mo product for industrial distributors / supply houses who want to know which contractors are about to buy stock). It is **NOT** pitching Talent Radar / hiring help.

3. **Why it sounds AI-slop:** The 3 templates are static `${variable}` mad-libs. Every DM follows the exact same sentence structure. "Hey — quick one. Saw {company} just posted X… free sample dossier" — repeated 40 times in your feed. That's why it reads like a bot.

4. **Wrong audience target:** The "Find decision-maker on LinkedIn" link searches for `"{company} operations director"` — but if the signal is McKinley Mechanical (a **contractor** doing the hiring), you don't want to DM their ops director. You want to DM ops directors at **supply houses** (your actual Supply Radar customer) and tell them "McKinley is about to buy a lot of HVAC equipment — get in front of them."

The whole tab is targeting the wrong end of the transaction.

---

### The reimagining — "Growth Signal Outreach" tab

**New structure: pick the play first, then the message writes itself for the right audience.**

```
┌───────────────────────────────────────────────────────────────────┐
│ 💼 Growth Signal Outreach              [↻ Refresh] [⚙ Templates]  │
│ ─────────────────────────────────────────────────────────────────│
│ 42 fresh growth signals · last scan 2h ago · Detroit · Macomb    │
│                                                                    │
│ STEP 1 — What are you selling today?                              │
│ ┌─────────────────┬──────────────────┬───────────────────────────┐│
│ │ 📦 Supply Radar │ 🎯 Talent Radar  │ 🏗 FieldDesk + Web Design ││
│ │ $199/mo         │ $149/mo           │ $1,499 + $199/mo          ││
│ │ → DM supply hou-│ → DM the hiring   │ → DM the contractor       ││
│ │   ses about THIS│   contractor for  │   directly — they're       ││
│ │   contractor's  │   help filling    │   growing, need ops infra  ││
│ │   incoming spend│   the roles       │                            ││
│ └─────────────────┴──────────────────┴───────────────────────────┘│
│  ↑ user picks ONE — everything below reshapes to match            │
└───────────────────────────────────────────────────────────────────┘
```

After play is picked, each signal card rebuilds for that play:

**Play 1 — Supply Radar (DM supply houses):**
```
🎯 OPPORTUNITY: McKinley Mechanical
   Detroit · Commercial HVAC · Pulled 12 permits + 8 hires last 30d
   → Predicted spend: HVAC commercial equipment, copper pipe, refrigerant
   → Estimated value: $80k–$200k over next 60 days

WHO TO DM: Sales managers at:
   • Behler-Young (Detroit HVAC distributor) [LinkedIn ↗]
   • Johnstone Supply Detroit              [LinkedIn ↗]
   • Standard Plumbing & Heating           [LinkedIn ↗]

DM TO SEND (NOT mad-libs — actually written):
┌──────────────────────────────────────────────────────────┐
│ Hi {Name} — heads up, McKinley Mechanical pulled 12      │
│ commercial HVAC permits in Detroit this month and is     │
│ hiring 8 techs. They're about to need a lot of equipment │
│ fast. If you want a heads-up list of contractors like    │
│ this every Monday, we run a tracker → $199/mo, 7-day     │
│ free trial. Worth a look?                                 │
└──────────────────────────────────────────────────────────┘
[Copy DM]  [Open LinkedIn search]  [Mark "sent"]  [Skip]
```

**Play 2 — Talent Radar (DM the contractor):**
```
🎯 OPPORTUNITY: McKinley Mechanical (HIRING)
   8 HVAC techs needed · Detroit · Posted 4 days ago
   → Pain: takes 60+ days to fill licensed HVAC roles in MI

WHO TO DM:
   • Owner / GM at McKinley Mechanical [LinkedIn ↗]

DM:
┌──────────────────────────────────────────────────────────┐
│ Hi {Name} — saw your 8 HVAC tech postings. We monitor    │
│ MIOSHA license issues + permit activity across Michigan  │
│ and ping you the moment a licensed tech becomes          │
│ available. Detroit Web Agency, $149/mo, runs in the      │
│ background. Want me to send you 3 candidates we already  │
│ have on file?                                             │
└──────────────────────────────────────────────────────────┘
```

**Play 3 — FieldDesk + Web Design (DM the contractor):**
Same target as Play 2 but pitch is operational infra ("you're scaling — your dispatch board / website is going to be the bottleneck").

---

### What changes technically

**Single file rewrite:** `src/components/admin/AdminLinkedInBlitz.tsx` becomes `AdminGrowthSignalOutreach.tsx` (keep the old file as a redirect for one release).

1. **Top of file: "Play Selector"** — three big cards (Supply Radar / Talent Radar / FieldDesk+Web). Stored in `useState<Play>`.

2. **DM templates moved to a real registry** — `src/lib/outreachTemplates.ts`:
   - 3 plays × 3 tones each (direct / curious / value-first) = 9 hand-written templates
   - Each template has `audience` field (`supply_house | contractor_owner | contractor_ops`) so the wrong template can never be paired with the wrong target
   - Templates are written like a human wrote them — no "I track 42 of these this week" filler, no forced "free dossier" CTA on every line

3. **Signal card rewrites itself based on play:**
   - **Supply Radar play** → header shows estimated $ spend + commodity list, "Who to DM" lists 3 nearby supply houses (hardcoded distributor list per metro, starting with Detroit's 8 majors), DM is supply-house-targeted
   - **Talent Radar play** → header shows role + days-on-market, "Who to DM" is the contractor's owner, DM is hiring-help-targeted  
   - **FieldDesk play** → header shows growth indicators (permits + hires), DM is ops-infrastructure-targeted

4. **"Find decision-maker on LinkedIn"** link gets smarter — searches for the right title at the right company per play (e.g., `"Behler-Young" "sales manager"` for Supply Radar, `"McKinley Mechanical" owner OR president` for Talent Radar).

5. **Mark-sent tracking** — new local state + optional DB row in `outreach_log` so a signal you've already DM'd gets greyed out and dropped to the bottom (no more re-DMing the same 40 leads every time you open the tab).

6. **Tab rename in `DWAAdmin.tsx`:** `💼 LinkedIn Blitz` → `🎯 Growth Outreach` and tooltip explains "Pick what you're selling, get the right DM for the right person."

---

### What this fixes vs. your screenshot

- ❌ Today: McKinley card has identical copy to every other card, pitches "dossier" with no clear product, links to the wrong person on LinkedIn
- ✅ After: McKinley card shows "$80–200k incoming HVAC spend" up top, lists 3 Detroit supply houses to DM, and the DM clearly pitches Supply Radar at $199/mo with a real ask

### Files touched

- **NEW**: `src/lib/outreachTemplates.ts` (~150 lines — 9 hand-written templates, audience-typed)
- **NEW**: `src/lib/metroDistributors.ts` (~80 lines — Detroit/DFW/Phoenix HVAC + plumbing + electrical distributor lists with LinkedIn URLs)
- **REWRITTEN**: `src/components/admin/AdminLinkedInBlitz.tsx` → renamed/refactored to `AdminGrowthSignalOutreach.tsx` (~400 lines)
- **EDITED**: `src/pages/DWAAdmin.tsx` (rename tab label, swap import)
- **NEW migration** (small): `outreach_signal_log` table — 4 columns (signal_id, play, sent_at, admin_id) for "mark sent" persistence

No edge function changes, no Stripe changes, no scanner changes — all 42 signals in your screenshot stay; they just get presented in a way that actually tells you what to do with each one.


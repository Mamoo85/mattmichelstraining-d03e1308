

# Full Audit: User Portal & Admin Dashboard — Cleanup & Reorganization

## Audit Findings

### USER PORTAL — Redundancies Found

1. **Progress tab in Dashboard duplicates `/progress` page**
   - Dashboard "Progress" tab renders `<ProgressCharts />` with no props
   - `/progress` page renders the same `<ProgressCharts />` but with admin client-selector and parent-child view support
   - The Dashboard tab is a strictly inferior duplicate

2. **Referral Dashboard appears in two places**
   - Dashboard "Refer" tab renders `<ReferralDashboard />`
   - Profile page also embeds `<ReferralDashboard />`
   - Redundant — keep it in Dashboard, remove from Profile (Profile should link to it instead)

3. **"My Programs" shown in both Dashboard and Profile**
   - Dashboard has a full "My Programs" tab
   - Profile lists active/purchased programs with a "Go to Dashboard" link — this is fine as a summary, but the full list is redundant

4. **"Manage Subscription" button duplicated**
   - Dashboard header has a "Manage" button
   - Profile page has "Manage Plan" + "Change Plan · Update Payment" + "Cancel Subscription" — all calling the same `customer-portal` function
   - Dashboard header button is redundant; Profile is the proper home for account management

### ADMIN DASHBOARD — Misplaced Tabs & Redundancies

5. **"Service Catalog" is in The Vault but belongs in Site Content**
   - Services (service offerings displayed on the site) are content, not financials

6. **"Schedule" is in Training Engine but is operational, not training content**
   - Schedule management (slot availability) is closer to The Roster (operations) than Training Engine

7. **AI tabs are scattered across two master tabs**
   - Training Engine has: AI Generator, AI Programs, AI Queue, AI Copilot, AI Toolkit (5 tabs)
   - Site Content has: AI Business Tools (1 tab)
   - These should be consolidated: merge AI Copilot into AI Toolkit, and group the business tools alongside

8. **"Churn Radar" is in The Roster but is a business/revenue concern**
   - Churn prediction relates to revenue retention — belongs in The Vault

9. **"Ad Drafts" and "AI Business Tools" should be grouped together**
   - Ad Drafts are outputs of AI Business Tools — they should be adjacent or merged

10. **Too many sub-tabs in The Roster (11 tabs)**
    - "Posture Requests" and "Videos" are coaching review tasks — could merge into "Coach Review"
    - "Onboarding" and "Trial Settings" are both new-user management — could combine

---

## Proposed Changes

### User Portal (Dashboard + Profile)

| Change | Action |
|--------|--------|
| Remove "Progress" tab from Dashboard | Delete tab; users use `/progress` page (already in navbar via the route) |
| Remove `<ReferralDashboard>` from Profile | Replace with a link/button to Dashboard "Refer" tab |
| Remove "Manage" button from Dashboard header | Profile is the canonical place for subscription management |

### Admin Dashboard — Reorganized Tab Structure

**The Roster** (People & Communications — 8 tabs, down from 11)
- All Users
- Support Tickets
- Coach Review ← merge Posture Requests + Videos into this tab
- Messages
- Families & Teams
- Parent Hub
- Onboarding & Trials ← merge Trial Settings + Onboarding
- Schedule ← moved from Training Engine

**Training Engine** (Programs & AI — 9 tabs, down from 12)
- Programs
- Exercise Library
- Protocols
- AI Generator ← batch generator
- AI Programs
- AI Queue
- AI Toolkit ← absorb AI Copilot as a section within it
- Recovery Map
- Monthly Focus
- Biomechanics

**The Vault** (Revenue & Business — 8 tabs)
- Revenue & Ledger
- Promotions
- Points
- Tier Access
- System & Referrals
- Stripe Products
- Churn Radar ← moved from Roster
- Service Catalog ← moved from Vault (or keep here since it relates to pricing)

**Site Content** (CMS & Marketing — 9 tabs)
- Front Page
- Site Editor
- Testimonials
- Learn Hub
- Broadcasts
- Subscribers
- Compose
- Send History
- Marketing & AI ← merge "Ad Drafts" + "AI Business Tools" into one tab

### Technical Details

**Files to modify:**
- `src/pages/Dashboard.tsx` — Remove "Progress" tab from `BASE_TABS`, remove ProgressCharts import, remove "Manage" button from header
- `src/pages/Profile.tsx` — Remove inline `<ReferralDashboard />`, replace with a link to Dashboard referrals tab
- `src/pages/Admin.tsx` — Reorganize all four master tab sections per the structure above:
  - Merge Posture Requests + Videos into Coach Review div
  - Merge Trial Settings + Onboarding into one tab
  - Move Schedule to Roster
  - Move Churn Radar to Vault
  - Merge AI Copilot into AI Toolkit
  - Merge Ad Drafts + AI Business Tools into "Marketing & AI" tab
- `src/components/admin/AdminAiToolkit.tsx` — Add AI Copilot as a section/accordion within the toolkit (minor integration)

**No database changes required.** All changes are UI reorganization only.




# Plan — Make the Fax (and Postcard) Campaign cards clickable + sendable

## What's broken
On the **Outreach Command Center → Active Campaigns** tab, each row in the **Fax Campaigns** and **Postcard Campaigns** cards is plain text. There is no click handler, no Send button, no Diagnose button. That's why clicking the "mixed / draft / 0 sent" fax row does nothing.

The send logic already exists and works — it lives in `AdminFaxCampaigns.tsx` (calls `send-fax-phaxio`) and `AdminPostcardCampaigns.tsx` (calls `send-postcards-lob`). It was just never wired into the consolidated Command Center cards.

## The fix (one component edit)

**File:** `src/components/dwa-admin/OutreachCommandCenter.tsx`

**Change 1 — Make `CampaignCard` action-aware.** Add an optional `actions` render-prop per row so fax/postcard rows can render Diagnose + Send buttons inline. Email/SMS rows stay read-only (they're logs, not drafts).

**Change 2 — Wire fax row actions:**
- **🔍 Diagnose** button → `supabase.functions.invoke("send-fax-phaxio", { body: { campaign_id, dry_run: true } })` → toast the prospect/cap/Phaxio-key result (same diagnostic block already shown in `AdminFaxCampaigns`)
- **📠 Send** button (only visible when `status === "draft"`) → confirm dialog → `send-fax-phaxio` with `{ campaign_id }` → toast `${sent} sent · ${failed} failed · $${cost}` → invalidate `fax_campaigns_active` query
- **↻ Resend failed** button (only visible when `status === "sent"` and there are failures) → calls `send-fax-phaxio` with `prospect_ids` of failed rows

**Change 3 — Wire postcard row actions** (mirror image):
- Diagnose → `send-postcards-lob` with `dry_run: true`
- Send → `send-postcards-lob` with `{ campaign_id }`
- Resend failed → `send-postcards-lob` with `prospect_ids`

**Change 4 — Show last error inline.** If `c.last_error` exists, render a small red `⚠ {error}` line under the row so you can see *why* a campaign failed without leaving the Command Center.

**Change 5 — Add a "✏️ Edit in full editor" link** on each fax/postcard row that deep-links to the dedicated `AdminFaxCampaigns` / `AdminPostcardCampaigns` tab (where you can edit subject/body, attach prospect lists, etc.) for anything more complex than send/resend.

## Why this is the right fix
- **No new edge functions.** `send-fax-phaxio`, `send-postcards-lob`, and the diagnose `dry_run` paths all already exist and are tested.
- **No schema changes.** `fax_campaigns.status`, `last_error`, `total_sent`, `total_cost` columns already drive the same UI in `AdminFaxCampaigns`.
- **Safe by design.** Send is gated behind a `confirm()` dialog. Diagnose is free (dry_run). Both invalidate the React Query cache so the row updates immediately.

## After ship — what you'll be able to do from the Command Center
1. Click **🔍 Diagnose** on the "mixed / draft / 0 sent" fax row → toast says *"3 ready to send · Phaxio API ✅ Working · cost $0.21"*
2. Click **📠 Send** → confirm → toast says *"✅ 3 sent · 0 failed · $0.21"* → row flips to `sent`, counter goes 0 → 3
3. Same flow works on the postcard cards (Lob)
4. Email + SMS cards stay read-only (correctly — they're activity feeds, not draft queues)

## Honest scope
~25 minutes. Single-file edit to `OutreachCommandCenter.tsx`. No backend, no migrations, no new functions.

## Not touching
- The dedicated `AdminFaxCampaigns` / `AdminPostcardCampaigns` tabs (already work — staying as the "full editor")
- `send-fax-phaxio` / `send-postcards-lob` edge functions (already correct)
- The 5 cron jobs from the previous ship
- The Stripe/Marketplace work (next session, as you said)


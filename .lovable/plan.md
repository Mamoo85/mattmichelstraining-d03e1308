

# DWA Living Command Center — Internal Wiki & Strategy Board

## What We're Building

Two new tabs in the DWA Admin dashboard that serve as your internal playbook — a living, searchable, printable knowledge base for running Detroit Web Agency. Everything you need to onboard yourself, hand a client a clean PDF, or look up how any system works.

## Database (3 new tables)

**`product_wiki`** — Your systems encyclopedia
- `id`, `product_name`, `category` (enum: "core_product" | "add_on" | "system" | "process"), `description` (rich text/markdown), `client_description` (the clean client-facing version), `priority_rank`, `tech_stack` (text[]), `monthly_operating_cost` (numeric), `dev_hours_spent` (numeric), `active_hooks_count` (int), `agent_connections` (text[] — which agents touch this product), `printable_steps` (jsonb — step-by-step array with title/body/image_url), `last_updated` (timestamptz), `updated_by` (text)
- RLS: service_role + admin only

**`business_strategy`** — Single-row strategy config
- `id`, `primary_targets` (text[]), `secondary_targets` (text[]), `monthly_overhead_target` (numeric), `monthly_revenue_target` (numeric), `mission_statement` (text), `competitive_advantages` (text[]), `key_risks` (text[]), `quarterly_goals` (jsonb), `updated_at`
- RLS: service_role + admin only

**`ad_spend_allocation`** — Marketing budget breakdown
- `id`, `platform` (text — LinkedIn, Local SEO, Direct Mail, etc.), `percentage_allocation` (numeric), `monthly_budget` (numeric), `status` (text — active/paused/planned), `notes` (text), `updated_at`
- RLS: service_role + admin only

## UI Components (2 new tabs)

### Tab 1: "📖 Playbook" (Matt's Guide)

A searchable wiki with two view modes per entry: **Matt's Copy** (internal — costs, agents, tech debt, real talk) and **Client Copy** (clean, professional, no internals).

- **Left sidebar**: Category tree (Core Products, Add-Ons, Systems, Processes) with search filter
- **Main panel**: Selected wiki entry with:
  - Editable markdown description (using a textarea with preview toggle — not a heavy WYSIWYG)
  - "Matt's View" / "Client View" toggle
  - Step-by-step guide section (ordered steps with title + description + optional image URL)
  - Metrics card: Priority rank, Tech Stack badges, Monthly Cost, Dev Hours, Active Hooks
  - **Agent Connections** panel: Which agents (from your 31) touch this product and what they do
- **Actions bar**:
  - "Print Matt's Copy" — generates browser print-friendly view (CSS @media print)
  - "Print Client Copy" — same but only shows client_description + steps, no cost/agent data
  - "Save as PDF" — uses browser print-to-PDF (no server-side PDF generation needed)
- **Auto-seed**: On first load, if the table is empty, seed it with entries from the existing `knowledge/M2_Product_Catalog.md` (the 36 products) and `knowledge/field-service-brief.md` (FieldDesk, SiteRadar, TechAlert). This runs client-side via a "Seed from Knowledge Base" button.

### Tab 2: "📊 Strategy" (Business Plan & Ad Spend)

- **Top section**: Editable strategy card — primary/secondary targets as tag inputs, revenue/overhead targets as number inputs, mission statement textarea, competitive advantages list
- **Bottom section**: Ad Spend allocation
  - Editable table of platforms with percentage + monthly budget + status
  - **Recharts PieChart** showing allocation breakdown by platform (uses existing recharts dependency)
  - **Progress bars** showing each platform's spend vs target
- **Print view**: Clean single-page strategy summary with pie chart for board meetings

## Agent Integration Points (Audit Results)

Here are places where agents can be wired into this system:

1. **Oz Agent** — can auto-update `product_wiki.active_hooks_count` and `dev_hours_spent` by scanning the codebase weekly
2. **Cashier Agent** — can auto-update `product_wiki.monthly_operating_cost` from Stripe/Twilio/Resend usage
3. **Scout Agent** — can auto-populate `business_strategy.key_risks` from competitive intel scans
4. **Rev Agent** — can auto-update `ad_spend_allocation` based on actual Stripe revenue by source
5. **Scarlett Agent** — can auto-generate `product_wiki.client_description` drafts from the internal description
6. **Trim Agent** — can flag stale wiki entries (last_updated > 30 days) in the morning digest
7. **Tom Agent** — can reference `product_wiki.client_description` when generating cold emails (instead of hardcoded pitches)

These connections will be stored in `agent_connections` on each wiki entry and displayed in the UI. The actual agent wiring is Phase 2 (separate edge function updates).

## Print/PDF Architecture

No server-side PDF generation. Instead:
- CSS `@media print` styles that hide nav, tabs, and non-essential UI
- A "Print" button that calls `window.print()` with the appropriate view (Matt vs Client)
- The print stylesheet formats content as a clean document with DWA branding header
- Works in any browser, saves to PDF via the browser's built-in "Save as PDF" printer

## Files to Create/Modify

1. **Migration**: `product_wiki`, `business_strategy`, `ad_spend_allocation` tables + RLS
2. **`src/components/dwa-admin/DWAPlaybook.tsx`** — Wiki tab component
3. **`src/components/dwa-admin/DWAStrategy.tsx`** — Strategy tab component  
4. **`src/components/dwa-admin/PlaybookPrintView.tsx`** — Print-optimized layout
5. **`src/pages/DWAAdmin.tsx`** — Add two new tabs ("📖 Playbook", "📊 Strategy")
6. **`src/index.css`** — Add `@media print` styles for clean PDF output

## Implementation Order

1. Run migration (3 tables + RLS)
2. Build DWAPlaybook.tsx with CRUD, search, Matt/Client toggle, print
3. Build DWAStrategy.tsx with editable targets + Recharts pie chart + print
4. Wire both into DWAAdmin.tsx tabs
5. Add print CSS
6. Seed initial wiki data from knowledge files


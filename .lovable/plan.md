

# Batch: Phase 2 Ventures + Anthropic → Lovable AI Migration

## Two workstreams in one batch

### Workstream A: Phase 2 — 5 New Ventures (Compliance & Operations)

Each venture gets: DB table, checkout function, sender function, landing page, Stripe webhook handler, Admin Client Health row.

**Venture 3: AI Permit & License Monitor — $79/mo**
- Table: `permit_monitor_clients` (business_name, email, industry, city, permits jsonb, active, send_count, last_sent_at)
- `create-permit-monitor-checkout` → Stripe subscription
- `permit-monitor-sender` → Firecrawl scrapes municipal sites for permit/license info, Lovable AI generates 60/30/7-day reminder digest, Resend delivers
- Landing page: `src/pages/AIPermitMonitor.tsx`

**Venture 4: AI OSHA/Safety Compliance Checker — $99/mo**
- Table: `osha_compliance_clients` (business_name, email, industry, employee_count, active, send_count, last_sent_at)
- `create-osha-compliance-checkout` → Stripe subscription
- `osha-compliance-sender` → Lovable AI generates monthly safety checklists + OSHA regulation updates per industry, Resend delivers
- Landing page: `src/pages/AIOshaCompliance.tsx`

**Venture 11: AI Late Payment Collector — $49/mo**
- Table: `collections_clients` (business_name, email, industry, active, send_count, last_sent_at)
- Table: `collections_contacts` (client_email, debtor_name, debtor_email, debtor_phone, amount_owed, days_overdue, escalation_level, last_sent_at)
- `create-collections-checkout` → Stripe subscription
- `collections-sender` → AI generates escalating collection letters (friendly → firm → pre-collections), Resend delivers sequence based on escalation_level
- Landing page: `src/pages/AICollections.tsx`

**Venture 12: AI Inventory Reorder Alerts — $49/mo**
- Table: `inventory_alert_clients` (business_name, email, industry, active, send_count, last_sent_at)
- Table: `inventory_items` (client_email, item_name, par_level, current_stock, avg_daily_usage, last_alerted_at)
- `create-inventory-alert-checkout` → Stripe subscription
- `inventory-alert-sender` → Checks items below par level, AI generates reorder report with supplier suggestions, Resend delivers
- Landing page: `src/pages/AIInventoryAlerts.tsx`

**Venture 15: AI Customer Birthday/Anniversary Campaign — $29/mo**
- Table: `birthday_campaign_clients` (business_name, email, industry, twilio_number, active, send_count, last_sent_at)
- Table: `birthday_contacts` (client_email, contact_name, contact_phone, contact_email, birthday date, anniversary date, last_sent_at)
- `create-birthday-campaign-checkout` → Stripe subscription
- `birthday-campaign-sender` → Daily check for upcoming birthdays/anniversaries, AI generates personalized offers, sends via Resend + Twilio SMS
- Landing page: `src/pages/AIBirthdayCampaign.tsx`

**Shared changes:**
- Add 5 new `meta.type` handlers to `stripe-webhook/index.ts`
- Add 5 new service rows to `AdminClientHealth.tsx`
- Add routes to `App.tsx`
- Add services to `M2Development.tsx`

---

### Workstream B: Migrate 36 Edge Functions from Anthropic → Lovable AI Gateway

Replace all `api.anthropic.com/v1/messages` calls with `ai.gateway.lovable.dev/v1/chat/completions` using `LOVABLE_API_KEY` (already in secrets). No new key needed.

**Pattern change per function:**

Before (Anthropic):
```ts
const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY") || "";
const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
  headers: { "x-api-key": ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "Content-Type": "application/json" },
  body: JSON.stringify({ model: "claude-haiku-4-5-20251001", max_tokens: 800, messages: [...] })
});
const content = aiData?.content?.[0]?.text;
```

After (Lovable AI):
```ts
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
  headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
  body: JSON.stringify({ model: "google/gemini-2.5-flash-lite", messages: [{ role: "user", content: prompt }] })
});
const content = aiData?.choices?.[0]?.message?.content;
```

**36 functions to migrate** (all in `supabase/functions/`):
newsletter-send, staff-newsletter-sender, ai-sales-script-writer, ai-direct-mail-writer, battlecard-sender, review-response-sender, market-intel-sender, handbook-sender, kpi-email-sender, review-responder, chatbot-widget, ai-hiring-assistant, ai-estimate-generator, welcome-drip-sender, promo-planner-generator, ai-google-qa-manager, ai-press-release-writer, ai-website-copy-refresher, ai-social-captions-generator, social-media-poster, gbp-saas-poster, industrial-newsletter-send, post-to-linkedin, multi-service-drip, reactivation-email-sender, ai-proposal-generator, web-design-drip, generate-web-proposal, score-business-presence, ai-video-script-writer, blog-post-monthly-sender, faq-refresh-sender, local-seo-monthly-sender, competitor-watch-weekly-sender, ads-copy-monthly-sender, ai-blog-post-writer

**New Phase 2 functions** will use Lovable AI from the start (not Anthropic).

---

### Implementation Order

1. **DB migration** — Create 7 new tables (5 client tables + 2 contact tables) with RLS
2. **5 checkout functions** — Stripe subscription creators
3. **5 sender functions** — All using Lovable AI Gateway
4. **5 landing pages** — Consistent M² Development dark theme
5. **Stripe webhook updates** — 5 new meta.type handlers
6. **Admin Client Health** — Add 5 service rows
7. **Routes + nav** — App.tsx + M2Development.tsx
8. **Anthropic migration** — Update all 36 existing functions to Lovable AI Gateway
9. **Deploy all** — Deploy new + updated functions




# Build Client Portal for Web Design + Add-On Services

## What We're Building

A **Client Portal** (`/client-portal`) where web design clients log in to see their site status and purchase add-on services. All other standalone services (dental, trucking, OSHA, etc.) remain untouched and continue selling independently.

## Architecture

```text
/client-portal (authenticated)
├── Site Status Card ── pulls from web_design_leads table
├── Active Add-Ons ── pulls from client_addons table  
├── Add-On Marketplace ── purchase buttons → Stripe checkout
└── Billing ── link to Stripe Customer Portal
```

## Steps

### 1. Database: Create `client_addons` table
New migration to track which add-ons a web design client has purchased:
- `id`, `lead_id` (references web_design_leads), `user_id` (auth user), `service_key` (e.g. `review_response`, `gbp_management`), `service_name`, `price_cents`, `stripe_subscription_id`, `status` (active/cancelled/paused), `activated_at`, `cancelled_at`
- RLS: service_role full access + authenticated users can SELECT their own rows

### 2. Create `ClientPortal.tsx` page
- Auth-gated page at `/client-portal`
- Fetches the logged-in user's `web_design_leads` record (matched by email)
- Shows site build status (prospect → intake → building → preview → live)
- Lists active add-ons from `client_addons`
- Marketplace grid of available add-ons (pulled from the same ADD_ONS config already in WebDesignServices.tsx, extracted to a shared constant)

### 3. Create `create-addon-checkout` edge function
- Accepts `service_key`, `price_cents`, `service_name`
- Creates a Stripe checkout session in subscription mode
- Attaches metadata: `type: "web_design_addon"`, `service_key`, `lead_id`
- On webhook completion, inserts into `client_addons`

### 4. Update Stripe webhook handler
- Add a case for `metadata.type === "web_design_addon"` that inserts into `client_addons` with the subscription ID and activates the service

### 5. Add route to App.tsx
- `/client-portal` → `ClientPortal.tsx`, wrapped in `ProtectedRoute`

### 6. Add portal link
- Add "Client Portal" link to web design pages and navigation for logged-in users

## What Stays Untouched
- All 90+ standalone service pages and their checkout functions remain as-is
- No services are archived or removed
- Lead generation is tabled — no changes there
- M2 Development hub stays intact

## Files Changed/Created

| File | Action |
|------|--------|
| `src/pages/ClientPortal.tsx` | **Create** — full portal page |
| `src/lib/addons.ts` | **Create** — shared add-on definitions |
| `supabase/functions/create-addon-checkout/index.ts` | **Create** — Stripe checkout for add-ons |
| `src/pages/WebDesignServices.tsx` | **Edit** — extract ADD_ONS to shared file, add portal link |
| `src/App.tsx` | **Edit** — add `/client-portal` route |
| Migration SQL | **New** — `client_addons` table + RLS |
| Webhook handler | **Edit** — handle `web_design_addon` type |


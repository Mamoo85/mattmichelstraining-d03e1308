// podClient — Supabase client for the secondary (POD pipeline) project.
// This project hosts: etsy_listings, etsy_listing_translations, etsy_email_signups,
// pod_product_queue, etsy_oauth_tokens, and all Printify/Etsy automation tables.
//
// The primary client (src/integrations/supabase/client.ts) is for M2 Training / DWA auth.
// Use podSupabase for anything GNG/storefront related.

import { createClient } from "@supabase/supabase-js";

const POD_URL =
  import.meta.env.VITE_POD_SUPABASE_URL ??
  "https://zmyczlfuufhngzovkjdh.supabase.co";

const POD_ANON_KEY =
  import.meta.env.VITE_POD_SUPABASE_ANON_KEY ??
  "eyJ.REDACTED.JWT";

export const podSupabase = createClient(POD_URL, POD_ANON_KEY, {
  auth: { persistSession: false },
});

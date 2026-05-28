// Secondary Supabase project — hosts Claude Code's Robinhood + Alpaca bot tables.
// Read-only from this app's perspective. Anon key is publishable (RLS enforced server-side).
import { createClient } from "@supabase/supabase-js";

const SECONDARY_URL = "https://zmyczlfuufhngzovkjdh.supabase.co";
const SECONDARY_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpteWN6bGZ1dWZobmd6b3ZramRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM0NDI5MjcsImV4cCI6MjA4OTAxODkyN30.wuhuK7HfVy3vu1twTUWMHj9z3QBuG3j36wXystCo8gs";

export const supabaseSecondary = createClient(SECONDARY_URL, SECONDARY_ANON_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

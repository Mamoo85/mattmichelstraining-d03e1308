// Public redirect: /functions/v1/track-prospect-link?token=XYZ
// Logs the click then 302s to /contractor-leads. Fail-open.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DEST_BASE = "https://detroitwebagent.com/contractor-leads";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  // Token can come from ?token= or trailing path segment
  let token = url.searchParams.get("token");
  if (!token) {
    const parts = url.pathname.split("/").filter(Boolean);
    token = parts[parts.length - 1] || "";
  }

  const redirectTo = token
    ? `${DEST_BASE}?ref=${encodeURIComponent(token)}`
    : DEST_BASE;

  // Fire-and-forget click log; never block redirect
  if (token && token !== "track-prospect-link") {
    try {
      const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
      await supabase
        .from("prospect_nudges")
        .update({ clicked_at: new Date().toISOString() })
        .eq("link_token", token)
        .is("clicked_at", null);
    } catch (_e) {
      // Fail-open: never break the prospect's journey
    }
  }

  return new Response(null, {
    status: 302,
    headers: { Location: redirectTo, "Cache-Control": "no-store" },
  });
});

// Saved-search alert dispatcher (E48).
// For every active row in saved_search_alerts, runs search_candidates_hybrid
// and emails matt@detroitwebagent.com a digest of new matches since last_run_at.
// Pure observability for now — no client emails.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SavedSearch {
  id: string;
  user_id: string | null;
  query: string | null;
  filters: Record<string, unknown> | null;
  last_run_at: string | null;
  notify_email: string | null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const { data: searches, error } = await sb
      .from("saved_search_alerts")
      .select("id, user_id, query, filters, last_run_at, notify_email")
      .eq("active", true)
      .limit(50);

    if (error) throw error;

    let dispatched = 0;
    let totalMatches = 0;

    for (const s of (searches ?? []) as SavedSearch[]) {
      const since = s.last_run_at ?? new Date(Date.now() - 24 * 3600_000).toISOString();
      const { data: matches, error: rpcErr } = await sb.rpc("search_candidates_hybrid", {
        _query: s.query ?? "",
        _filters: s.filters ?? {},
        _limit: 25,
        _since: since,
      });
      if (rpcErr || !matches || matches.length === 0) {
        await sb.from("saved_search_alerts").update({ last_run_at: new Date().toISOString() }).eq("id", s.id);
        continue;
      }

      const to = s.notify_email || "matt@detroitwebagent.com";
      const html = `<h2>Saved search: ${s.query ?? "(filters)"}</h2>
<p>${matches.length} new match${matches.length === 1 ? "" : "es"} since ${since}.</p>
<ul>${matches.slice(0, 10).map((m: Record<string, unknown>) => `<li><strong>${m.name ?? "—"}</strong> · ${m.current_title ?? ""} · ${m.county ?? ""} · score ${Number(m.score ?? 0).toFixed(2)}</li>`).join("")}</ul>`;

      try {
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Detroit Web Agency <matt@detroitwebagent.com>",
            to: [to],
            subject: `🔍 ${matches.length} new match${matches.length === 1 ? "" : "es"} for your saved search`,
            html,
          }),
        });
        dispatched++;
        totalMatches += matches.length;
      } catch {
        // log but continue
      }

      await sb.from("saved_search_alerts").update({ last_run_at: new Date().toISOString() }).eq("id", s.id);
    }

    return new Response(
      JSON.stringify({ ok: true, searches: searches?.length ?? 0, dispatched, total_matches: totalMatches }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    return new Response(
      JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }),
      { status: 500, headers: { ...cors, "Content-Type": "application/json" } },
    );
  }
});

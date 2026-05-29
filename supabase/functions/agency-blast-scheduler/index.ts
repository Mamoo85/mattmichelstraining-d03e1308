// agency-blast-scheduler — Daily cron at 9am ET (13:00 UTC).
// Pulls up to 20 enriched agencies from talent_prospect_list that haven't been
// contacted yet, calls agency-prospect-list-blast for each, marks them contacted.

import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const DAILY_CAP = 20;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let sent = 0;
  let skipped = 0;
  let errors = 0;
  const trace: string[] = [];

  try {
    // Pull uncontacted agencies that have an email and are enriched
    const { data: agencies, error } = await sb
      .from("talent_prospect_list" as any)
      .select("id, company_name, contact_email, contact_name, contact_title, vertical, notes")
      .is("contacted_at", null)
      .not("contact_email", "is", null)
      .order("score", { ascending: false })
      .limit(DAILY_CAP);

    if (error) {
      return new Response(JSON.stringify({ ok: false, error: error.message }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (!agencies?.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, note: "No uncontacted enriched agencies" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    for (const agency of agencies) {
      if (!agency.contact_email || !agency.company_name) {
        skipped++;
        continue;
      }

      try {
        const blastRes = await fetch(
          `${SUPABASE_URL}/functions/v1/agency-prospect-list-blast`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            },
            body: JSON.stringify({
              agency_name: agency.company_name,
              agency_email: agency.contact_email,
              agency_contact_name: agency.contact_name || "",
              agency_contact_title: agency.contact_title || "Recruiting Director",
              vertical: agency.vertical || "industrial",
              agency_note: agency.notes || "",
            }),
            signal: AbortSignal.timeout(30000),
          }
        );

        const result = await blastRes.json().catch(() => ({}));

        if (blastRes.ok && (result as any).ok) {
          // Mark contacted
          await sb
            .from("talent_prospect_list" as any)
            .update({ contacted_at: new Date().toISOString() })
            .eq("id", agency.id);
          sent++;
          trace.push(`✅ ${agency.company_name} → ${agency.contact_email}`);
        } else {
          errors++;
          trace.push(`❌ ${agency.company_name}: ${(result as any).error || blastRes.status}`);
        }
      } catch (e) {
        errors++;
        trace.push(`❌ ${agency.company_name}: ${e instanceof Error ? e.message : String(e)}`);
      }

      // 500ms between sends to avoid Resend rate limits
      await new Promise((r) => setTimeout(r, 500));
    }

    return new Response(
      JSON.stringify({ ok: true, sent, skipped, errors, trace }),
      { headers: { ...cors, "Content-Type": "application/json" } },
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

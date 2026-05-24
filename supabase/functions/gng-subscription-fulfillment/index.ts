// Daily cron: scans gng_subscriptions for active subs whose next_ship_date <= today,
// creates a pending shipment row (so it shows up in Lisa's admin queue) and bumps
// next_ship_date by one month. For digital plans (pattern-of-the-month), marks shipped
// immediately. Sends Matt a daily SMS summary of what needs to ship.
// Cron: daily 13:00 UTC. Manual: POST { dry_run? }.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function addOneMonth(d: Date): Date {
  const out = new Date(d);
  out.setMonth(out.getMonth() + 1);
  return out;
}

function periodLabel(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const dryRun = body.dry_run === true;
    const today = new Date().toISOString().slice(0, 10);

    const { data: subs, error } = await sb
      .from("gng_subscriptions")
      .select("id, plan_slug, customer_email, customer_name, next_ship_date")
      .eq("status", "active")
      .lte("next_ship_date", today);
    if (error) throw error;

    const { data: plans } = await sb
      .from("gng_subscription_plans")
      .select("slug, name, is_digital");
    const planMap = new Map<string, { name: string; is_digital: boolean }>();
    for (const p of plans ?? []) planMap.set(p.slug, { name: p.name, is_digital: !!p.is_digital });

    let created = 0;
    let skipped = 0;
    const summaryByPlan: Record<string, number> = {};

    for (const s of subs ?? []) {
      const plan = planMap.get(s.plan_slug);
      const label = periodLabel(new Date());
      const isDigital = plan?.is_digital ?? false;

      if (dryRun) {
        summaryByPlan[s.plan_slug] = (summaryByPlan[s.plan_slug] ?? 0) + 1;
        continue;
      }

      // Idempotent: unique on (subscription_id, period_label)
      const { error: insErr } = await sb.from("gng_subscription_shipments").insert({
        subscription_id: s.id,
        plan_slug: s.plan_slug,
        period_label: label,
        status: isDigital ? "shipped" : "pending",
        shipped_at: isDigital ? new Date().toISOString() : null,
      });
      if (insErr) {
        if (insErr.code === "23505") { skipped++; continue; }
        console.error("[shipment insert]", s.id, insErr.message);
        continue;
      }
      // Advance next_ship_date by 1 month
      const next = addOneMonth(new Date(s.next_ship_date as string));
      await sb.from("gng_subscriptions").update({
        next_ship_date: next.toISOString().slice(0, 10),
        updated_at: new Date().toISOString(),
      }).eq("id", s.id);
      created++;
      summaryByPlan[s.plan_slug] = (summaryByPlan[s.plan_slug] ?? 0) + 1;
    }

    // SMS Matt a daily heads-up if there's anything physical to ship
    const ADMIN_PHONE = Deno.env.get("ADMIN_PHONE");
    const TWILIO_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
    const TWILIO_TOK = Deno.env.get("TWILIO_AUTH_TOKEN");
    const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER");
    if (!dryRun && created > 0 && ADMIN_PHONE && TWILIO_SID && TWILIO_TOK && TWILIO_FROM) {
      const lines = Object.entries(summaryByPlan).map(([slug, n]) => `${slug}: ${n}`).join(", ");
      const msg = `🧶 GNG boxes due today: ${created} shipments (${lines}). Admin → Subscriptions.`;
      try {
        await fetch(`https://api.twilio.com/2010-04-01/Accounts/${TWILIO_SID}/Messages.json`, {
          method: "POST",
          headers: {
            Authorization: `Basic ${btoa(`${TWILIO_SID}:${TWILIO_TOK}`)}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({ To: ADMIN_PHONE, From: TWILIO_FROM, Body: msg }).toString(),
        });
      } catch (e) { console.error("[admin sms]", e); }
    }

    return new Response(JSON.stringify({
      ok: true,
      due_subs: subs?.length ?? 0,
      shipments_created: created,
      skipped_already_exists: skipped,
      summary_by_plan: summaryByPlan,
      dry_run: dryRun,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

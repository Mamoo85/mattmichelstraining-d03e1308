// marketplace-buyer-welcome — every 6h cron
// D1/D3/D7 drip after first purchase.

import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const TEMPLATES: Record<number, { subject: string; html: (email: string) => string }> = {
  1: {
    subject: "👋 Welcome to the marketplace — quick tips",
    html: () => `<h2>Welcome aboard.</h2>
      <p>Three things that'll save you time:</p>
      <ol>
        <li>Use filter chips at the top to narrow by ZIP, signal type, or score.</li>
        <li>Hit the ⭐ on any lead to "watch" it — we'll alert you if the score jumps or price drops.</li>
        <li>Your purchases live at <a href="https://detroitwebagent.com/marketplace/receipts">/marketplace/receipts</a> with fresh PDFs anytime.</li>
      </ol>
      <p><a href="https://detroitwebagent.com/marketplace" style="background:#00d4ff;color:#0a1628;padding:12px 20px;text-decoration:none;border-radius:6px">Browse marketplace</a></p>`,
  },
  3: {
    subject: "📋 Have you downloaded your dossier?",
    html: () => `<h2>Quick check-in.</h2>
      <p>Your purchased dossier PDF is signed for 30 days. If you haven't downloaded it yet, grab it now — you can also share a redacted version with your team.</p>
      <p><a href="https://detroitwebagent.com/marketplace/receipts" style="background:#00d4ff;color:#0a1628;padding:12px 20px;text-decoration:none;border-radius:6px">View receipts</a></p>`,
  },
  7: {
    subject: "🎯 Faster access? — First Look subscription",
    html: () => `<h2>You've been using the marketplace for a week.</h2>
      <p>Buyers on First Look ($49/mo) see new hot leads <strong>1 hour before</strong> everyone else. If you've been losing leads to faster buyers, that's the fix.</p>
      <p><a href="https://detroitwebagent.com/marketplace" style="background:#00d4ff;color:#0a1628;padding:12px 20px;text-decoration:none;border-radius:6px">Learn more</a></p>`,
  },
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const { data: locks } = await supabase
    .from("marketplace_lead_locks")
    .select("buyer_email, created_at")
    .eq("status", "sold")
    .gte("created_at", new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString())
    .order("created_at", { ascending: true });

  // Group by buyer, take earliest purchase
  const firstPurchase = new Map<string, Date>();
  for (const l of locks || []) {
    if (!l.buyer_email) continue;
    const d = new Date(l.created_at);
    const cur = firstPurchase.get(l.buyer_email);
    if (!cur || d < cur) firstPurchase.set(l.buyer_email, d);
  }

  let sent = 0;
  for (const [email, firstAt] of firstPurchase) {
    const ageHours = (Date.now() - firstAt.getTime()) / 3600 / 1000;
    let day = 0;
    if (ageHours >= 22 && ageHours < 30) day = 1;
    else if (ageHours >= 70 && ageHours < 78) day = 3;
    else if (ageHours >= 166 && ageHours < 174) day = 7;
    if (!day) continue;

    // Dedup: check system_comms_log for this template
    const tpl = TEMPLATES[day];
    const { data: existing } = await supabase
      .from("system_comms_log")
      .select("id")
      .eq("recipient", email)
      .eq("subject", tpl.subject)
      .limit(1)
      .maybeSingle();
    if (existing) continue;

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "Detroit Web Agency <matt@detroitwebagent.com>",
        to: email,
        subject: tpl.subject,
        html: tpl.html(email),
      }),
    }).catch(() => {});

    await supabase.from("system_comms_log").insert({
      channel: "email",
      recipient: email,
      subject: tpl.subject,
      body: `D${day} marketplace welcome`,
      product: "marketplace",
      direction: "outbound",
    });

    sent++;
  }

  return new Response(JSON.stringify({ ok: true, sent }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
});

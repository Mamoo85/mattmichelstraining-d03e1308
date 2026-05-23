// gng-sms-inbound — Twilio webhook for SMS replies. Parses YES/NO <code> and applies approved actions.
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };

async function applyApproval(sb: any, approval: any): Promise<{ ok: boolean; msg: string }> {
  if (approval.kind === "drift_fix" || approval.kind === "price_floor") {
    const { listing_id, new_price_cents } = approval.payload ?? {};
    if (!listing_id || !new_price_cents) return { ok: false, msg: "bad_payload" };
    // Call etsy-product-update (or fall back to logging the intent).
    const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/etsy-product-update`;
    const r = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ listing_id, price: (new_price_cents / 100).toFixed(2) }),
    });
    const text = (await r.text()).slice(0, 300);
    return { ok: r.ok, msg: r.ok ? `applied $${(new_price_cents / 100).toFixed(2)}` : `etsy_err ${r.status}: ${text}` };
  }
  if (approval.kind === "message_reply") {
    // Stub: in production calls etsy-message-send with payload.reply_text.
    return { ok: true, msg: "reply_queued (manual send pending)" };
  }
  return { ok: false, msg: "unknown_kind" };
}

function twiml(body: string) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${body}</Message></Response>`,
    { headers: { "Content-Type": "text/xml" } },
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const form = await req.formData();
  const raw = String(form.get("Body") ?? "").trim().toUpperCase();
  const m = raw.match(/^(YES|NO|Y|N)\s+([A-Z0-9]{3,8}|ALL)/);
  if (!m) {
    return twiml("Reply format: YES <code> or NO <code> (e.g. YES A1B2C). Send YES ALL to approve every pending GNG item.");
  }
  const verdict = m[1].startsWith("Y") ? "approved" : "rejected";
  const target = m[2];

  let approvals: any[] = [];
  if (target === "ALL") {
    const { data } = await sb.from("gng_approvals").select("*").eq("status", "pending").gt("expires_at", new Date().toISOString());
    approvals = data ?? [];
  } else {
    const { data } = await sb.from("gng_approvals").select("*").eq("short_code", target).maybeSingle();
    if (data) approvals = [data];
  }

  if (!approvals.length) return twiml(`No pending approval found for "${target}".`);

  const results: string[] = [];
  for (const a of approvals) {
    if (a.status !== "pending") { results.push(`${a.short_code}: already ${a.status}`); continue; }
    if (verdict === "rejected") {
      await sb.from("gng_approvals").update({ status: "rejected", responded_at: new Date().toISOString() }).eq("id", a.id);
      results.push(`${a.short_code}: rejected`);
      continue;
    }
    await sb.from("gng_approvals").update({ status: "approved", responded_at: new Date().toISOString() }).eq("id", a.id);
    const out = await applyApproval(sb, a);
    await sb.from("gng_approvals").update({
      status: out.ok ? "applied" : "failed",
      applied_at: out.ok ? new Date().toISOString() : null,
      apply_result: { msg: out.msg },
    }).eq("id", a.id);
    results.push(`${a.short_code}: ${out.msg}`);
  }
  return twiml(`✅ GNG\n${results.slice(0, 8).join("\n")}`);
});

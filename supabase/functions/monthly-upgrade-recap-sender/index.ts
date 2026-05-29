// Monthly Forever-Pricing recap. Cron: 1st of month, 8am ET (13:00 UTC).
import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const FROM_EMAIL = "matt@detroitwebagent.com";
const FROM_NAME = "Matt @ Detroit Web Agency";

function dwaEmail(bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#0a1628;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#e6f1ff;">
  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">
    <div style="text-align:center;margin-bottom:24px;">
      <span style="color:#00d4ff;font-weight:700;font-size:18px;letter-spacing:2px;">DETROIT WEB AGENCY</span>
    </div>
    <div style="background:#0f1f3a;border:1px solid #1f3a5f;border-radius:12px;padding:32px;">
      ${bodyHtml}
    </div>
    <p style="text-align:center;color:#6b8aa8;font-size:12px;margin-top:24px;">
      detroitwebagent.com · (313) 992-1219
    </p>
  </div></body></html>`;
}

interface Entry { ship_date: string; product: string; title: string; body: string; }

function buildBody(name: string, monthLabel: string, entries: Entry[], lockedPrice: number, lockedSince: string): string {
  const list = entries.map(
    (e) => `<li style="margin-bottom:14px;"><strong style="color:#00d4ff;">${e.title}</strong><br><span style="color:#a8c5e0;font-size:13px;">${e.product} · ${e.ship_date}</span><br><span style="color:#cfe1f5;font-size:14px;">${e.body}</span></li>`
  ).join("");
  return `
    <h2 style="color:#fff;margin:0 0 8px;">Hi ${name},</h2>
    <p style="color:#cfe1f5;font-size:15px;line-height:1.6;">Here's everything we shipped in <strong>${monthLabel}</strong> — all of it included free in your account, forever.</p>
    <div style="background:#0a1628;border-left:3px solid #00d4ff;padding:12px 16px;margin:20px 0;border-radius:4px;">
      <p style="margin:0;color:#00d4ff;font-size:13px;font-weight:600;">YOUR PRICE LOCK</p>
      <p style="margin:4px 0 0;color:#fff;font-size:16px;">$${lockedPrice.toFixed(0)}/mo · since ${lockedSince}</p>
      <p style="margin:4px 0 0;color:#a8c5e0;font-size:12px;">Will never go up. Every future upgrade included.</p>
    </div>
    <ul style="padding-left:20px;color:#cfe1f5;">
      ${list || '<li style="color:#a8c5e0;">Quiet month on the public changelog — but background infrastructure work continued.</li>'}
    </ul>
    <p style="color:#cfe1f5;font-size:14px;margin-top:24px;">Reply any time with feature requests or questions.<br>— Matt</p>
    <p style="color:#6b8aa8;font-size:12px;margin-top:24px;"><a href="https://detroitwebagent.com/changelog" style="color:#00d4ff;">See the full changelog →</a></p>
  `;
}

async function sendEmail(to: string, subject: string, html: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to: [to], subject, html, reply_to: FROM_EMAIL }),
  });
  if (!res.ok) return { ok: false, error: `Resend ${res.status}: ${await res.text()}` };
  return { ok: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const now = new Date();
    const startThisMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const startLastMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 1, 1));
    const monthLabel = startLastMonth.toLocaleString("en-US", { month: "long", year: "numeric", timeZone: "UTC" });

    const { data: entries, error: entriesErr } = await sb
      .from("product_changelog")
      .select("ship_date, product, title, body")
      .eq("is_public", true)
      .gte("ship_date", startLastMonth.toISOString().slice(0, 10))
      .lt("ship_date", startThisMonth.toISOString().slice(0, 10))
      .order("ship_date", { ascending: false });
    if (entriesErr) throw entriesErr;

    const { data: locks, error: locksErr } = await sb
      .from("client_price_locks")
      .select("client_email, locked_monthly_price, locked_since, product")
      .eq("active", true);
    if (locksErr) throw locksErr;

    const results: Array<{ email: string; ok: boolean; error?: string }> = [];
    for (const lock of locks || []) {
      const name = (lock.client_email as string).split("@")[0] || "there";
      const html = dwaEmail(
        buildBody(
          name, monthLabel, (entries || []) as Entry[],
          Number(lock.locked_monthly_price),
          new Date(lock.locked_since as string).toLocaleDateString("en-US", { month: "short", year: "numeric" })
        )
      );
      const res = await sendEmail(lock.client_email as string, `${monthLabel} upgrades — yours, free, forever`, html);
      results.push({ email: lock.client_email as string, ok: res.ok, error: res.error });
      await new Promise((r) => setTimeout(r, 250));
    }

    return new Response(JSON.stringify({
      ok: true, month: monthLabel, entries_count: (entries || []).length,
      sent: results.filter((r) => r.ok).length, failed: results.filter((r) => !r.ok).length, results,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

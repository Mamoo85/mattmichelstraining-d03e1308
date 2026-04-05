import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY")!;

const JSON_HEADERS = { "Content-Type": "application/json" };
const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const URGENCY_CONFIG: Record<string, { label: string; color: string; emoji: string }> = {
  action:      { label: "Action Required",  color: "#dc2626", emoji: "🚨" },
  hot_lead:    { label: "Hot Leads",         color: "#e8621a", emoji: "🔥" },
  fyi:         { label: "FYI",               color: "#1e293b", emoji: "ℹ️" },
  celebration: { label: "Celebrations",      color: "#16a34a", emoji: "🎉" },
};

function buildDigestHtml(groups: Record<string, { title: string; body: string; link?: string }[]>, total: number): string {
  const sections = Object.entries(URGENCY_CONFIG)
    .filter(([key]) => groups[key]?.length)
    .map(([key, cfg]) => {
      const items = groups[key].map(n => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid #f1f5f9;">
            <strong style="color:#1e293b;">${n.title}</strong><br>
            <span style="color:#64748b;font-size:14px;">${n.body}</span>
            ${n.link ? `<br><a href="${n.link}" style="color:#e8621a;font-size:13px;">View →</a>` : ""}
          </td>
        </tr>`).join("");
      return `
        <tr><td style="padding:20px 0 8px;">
          <h2 style="margin:0;font-size:16px;color:${cfg.color};">${cfg.emoji} ${cfg.label} (${groups[key].length})</h2>
        </td></tr>
        <tr><td><table width="100%" cellpadding="0" cellspacing="0">${items}</table></td></tr>`;
    }).join("");

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f8fafc;font-family:sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:32px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 4px rgba(0,0,0,.08);">
        <tr><td style="background:#1e293b;padding:24px 32px;">
          <h1 style="margin:0;color:#fff;font-size:22px;">M² Daily Digest</h1>
          <p style="margin:4px 0 0;color:#94a3b8;font-size:14px;">${total} notification${total !== 1 ? "s" : ""} from the last 24 hours</p>
        </td></tr>
        <tr><td style="padding:24px 32px;">
          <table width="100%" cellpadding="0" cellspacing="0">${sections}</table>
        </td></tr>
        <tr><td style="background:#f8fafc;padding:16px 32px;border-top:1px solid #e2e8f0;text-align:center;">
          <p style="margin:0;color:#94a3b8;font-size:12px;">
            M² Development · Grosse Pointe, MI 48230<br>
            <a href="https://mattmichelstraining.com/unsubscribe" style="color:#94a3b8;">Unsubscribe</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS_HEADERS });

  try {
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: notifications, error } = await supabase
      .from("notifications")
      .select("id, type, title, body, link, urgency, category, is_read, created_at")
      .eq("is_read", false)
      .gte("created_at", since)
      .order("created_at", { ascending: false });

    if (error) throw error;
    if (!notifications?.length) return new Response(JSON.stringify({ sent: false, reason: "no unread notifications" }), { headers: JSON_HEADERS });

    const groups: Record<string, { title: string; body: string; link?: string }[]> = {};
    for (const n of notifications) {
      const key = n.urgency ?? "fyi";
      if (!groups[key]) groups[key] = [];
      groups[key].push({ title: n.title, body: n.body, link: n.link });
    }

    const html = buildDigestHtml(groups, notifications.length);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: "M² Training <matt@mattmichelstraining.com>",
        to: ["matt@mattmichelstraining.com"],
        subject: `M² Daily Digest — ${notifications.length} notification${notifications.length !== 1 ? "s" : ""}`,
        html,
      }),
    });

    if (!res.ok) throw new Error(`Resend error: ${await res.text()}`);

    return new Response(JSON.stringify({ sent: true, count: notifications.length }), { headers: JSON_HEADERS });
  } catch (err) {
    console.error("admin-notification-digest error:", err);
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: JSON_HEADERS });
  }
});

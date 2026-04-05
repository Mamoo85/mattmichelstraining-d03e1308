import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const JSON_HEADERS = { "Content-Type": "application/json" };

const CAN_SPAM_FOOTER = `
  <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:11px;color:#94a3b8;text-align:center">
    M² Development · Grosse Pointe, MI 48230<br>
    <a href="https://mattmichelstraining.com/unsubscribe" style="color:#94a3b8">Unsubscribe</a>
  </div>`;

// Thresholds in ascending order; index = reminders_sent value that must be exceeded before firing
const THRESHOLDS = [90, 60, 30, 14, 7];

function urgencyColor(days: number): string {
  if (days <= 14) return "#dc2626";
  if (days <= 30) return "#d97706";
  return "#16a34a";
}

function urgencyLabel(days: number): string {
  if (days <= 14) return "URGENT";
  if (days <= 30) return "Action Required";
  return "Heads Up";
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, content-type" } });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Join license items with their active clients
  const { data: items, error } = await (sb as any)
    .from("license_monitor_items")
    .select("*, license_monitor_clients!inner(*)")
    .eq("license_monitor_clients.active", true);

  if (error) {
    console.error("[license-expiry-checker] DB error:", error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: JSON_HEADERS });
  }

  let notified = 0;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const item of items ?? []) {
    try {
      const expiryDate = new Date(item.expiry_date);
      expiryDate.setHours(0, 0, 0, 0);
      const daysUntil = Math.round((expiryDate.getTime() - today.getTime()) / 86400000);

      if (daysUntil < 0) continue; // already expired

      // Find which threshold this day count matches
      const thresholdIndex = THRESHOLDS.findIndex((t) => daysUntil <= t);
      if (thresholdIndex === -1) continue; // more than 90 days out, no action

      // Only fire if we haven't already sent a reminder at this threshold level
      const remindedSoFar: number = item.reminders_sent ?? 0;
      if (remindedSoFar > thresholdIndex) continue; // already sent this threshold or higher

      const client = item.license_monitor_clients;
      const color = urgencyColor(daysUntil);
      const label = urgencyLabel(daysUntil);
      const formattedExpiry = expiryDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });

      const reminderText = await generateText(
        `Write a brief, friendly reminder that a business license is expiring. License: ${item.license_name}, Number: ${item.license_number ?? "N/A"}, Issuing body: ${item.issuing_body ?? "N/A"}, Expires: ${formattedExpiry}, Days left: ${daysUntil}. Include a call to action to renew. Keep it under 100 words.`,
        200
      );

      const html = `
<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:24px">
  <div style="background:#1e293b;padding:20px 24px;border-radius:8px 8px 0 0">
    <h1 style="color:#e8621a;margin:0;font-size:22px">M² License Monitor</h1>
    <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">License Renewal Reminder</p>
  </div>
  <div style="background:#f8fafc;border:1px solid #e2e8f0;border-top:none;padding:24px;border-radius:0 0 8px 8px">
    <div style="background:${color};color:#fff;padding:12px 20px;border-radius:6px;text-align:center;margin-bottom:20px">
      <div style="font-size:13px;font-weight:700;letter-spacing:1px">${label}</div>
      <div style="font-size:36px;font-weight:900;line-height:1.1">${daysUntil} days</div>
      <div style="font-size:13px;opacity:0.9">until expiry</div>
    </div>
    <table style="width:100%;border-collapse:collapse;font-size:13px;margin-bottom:20px">
      <tr>
        <td style="padding:8px 12px;background:#fff;border:1px solid #e2e8f0;color:#64748b">License</td>
        <td style="padding:8px 12px;background:#fff;border:1px solid #e2e8f0;font-weight:600">${item.license_name}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b">License Number</td>
        <td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600">${item.license_number ?? "N/A"}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#fff;border:1px solid #e2e8f0;color:#64748b">Issuing Body</td>
        <td style="padding:8px 12px;background:#fff;border:1px solid #e2e8f0;font-weight:600">${item.issuing_body ?? "N/A"}</td>
      </tr>
      <tr>
        <td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;color:#64748b">Expiry Date</td>
        <td style="padding:8px 12px;background:#f8fafc;border:1px solid #e2e8f0;font-weight:600;color:${color}">${formattedExpiry}</td>
      </tr>
    </table>
    <div style="background:#fff;border-left:3px solid ${color};padding:16px;border-radius:0 6px 6px 0;font-size:14px;line-height:1.7;color:#334155">
      ${reminderText}
    </div>
    ${CAN_SPAM_FOOTER}
  </div>
</div>`;

      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² License Monitor <matt@mattmichelstraining.com>",
          to: [client.email],
          subject: `[${label}] ${item.license_name} expires in ${daysUntil} days`,
          html,
        }),
      });

      await (sb as any)
        .from("license_monitor_items")
        .update({ reminders_sent: thresholdIndex + 1 })
        .eq("id", item.id);

      notified++;
    } catch (e) {
      console.error(`[license-expiry-checker] Error for item ${item.id}:`, e);
    }
  }

  console.log(`[license-expiry-checker] Notified ${notified} license items`);
  return new Response(JSON.stringify({ notified }), { status: 200, headers: JSON_HEADERS });
});

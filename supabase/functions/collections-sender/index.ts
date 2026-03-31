import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const { data: clients } = await sb.from("collections_clients").select("*").eq("active", true);
    if (!clients?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });

    let sent = 0;
    for (const client of clients) {
      try {
        const { data: contacts } = await sb.from("collections_contacts").select("*").eq("client_id", client.id).order("days_overdue", { ascending: false });
        if (!contacts?.length) continue;

        const escalationLabels = ["Friendly Reminder", "Firm Notice", "Final Warning / Pre-Collections"];
        let allLetters = "";

        for (const contact of contacts.slice(0, 10)) {
          const level = Math.min(contact.escalation_level || 0, 2);
          const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              model: "google/gemini-2.5-flash-lite",
              messages: [{ role: "user", content: `Write a ${escalationLabels[level]} collection letter from "${client.business_name}" to "${contact.debtor_name}" for $${contact.amount_owed} that is ${contact.days_overdue} days overdue.\n\nTone: ${level === 0 ? "friendly and professional" : level === 1 ? "firm but professional" : "urgent, final notice before collections referral"}.\n\nMust be FDCPA compliant. Include payment instructions placeholder. Under 200 words. Format as clean HTML.` }],
            }),
          });
          const aiData = await aiRes.json();
          const letter = aiData?.choices?.[0]?.message?.content || "<p>Letter unavailable.</p>";
          allLetters += `<div style="border:1px solid #334155;padding:15px;margin:10px 0;border-radius:8px;"><h4 style="color:#e8621a;">${contact.debtor_name} — $${contact.amount_owed} (${contact.days_overdue} days) — ${escalationLabels[level]}</h4>${letter}</div>`;

          await sb.from("collections_contacts").update({ escalation_level: level + 1, last_sent_at: new Date().toISOString() }).eq("id", contact.id);
        }

        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² Collections <matt@mattmichelstraining.com>", to: [client.email], bcc: ["matthewmichels4@gmail.com"],
              subject: `Collection Letters Ready — ${client.business_name} (${contacts.length} accounts)`,
        bcc: ["matthewmichels@gmail.com"],
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#1e293b;color:#e2e8f0;border-radius:12px;"><h2 style="color:#e8621a;">💰 Collection Letters</h2><p>Here are your collection letters. Review and send to debtors:</p>${allLetters}<hr style="border-color:#334155;"><p style="color:#64748b;font-size:12px;">Powered by M² Performance — matt@m2training.com</p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
        <div style="font-size:13px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
        </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div></div>`,
            }),
          });
        }
        await sb.from("collections_clients").update({ send_count: (client.send_count || 0) + 1, last_sent_at: new Date().toISOString() }).eq("id", client.id);
        sent++;
      } catch (e) { console.error(`[COLLECTIONS] Error for ${client.email}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); return new Response(JSON.stringify({ error: msg }), { status: 500 }); }
});

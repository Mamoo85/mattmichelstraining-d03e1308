import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY") || "";
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";

serve(async (_req) => {
  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  try {
    const { data: clients } = await sb.from("directory_submitter_clients").select("*").eq("active", true);
    if (!clients?.length) return new Response(JSON.stringify({ ok: true, sent: 0 }), { status: 200 });

    const directories = [
      "yelp.com", "yellowpages.com", "bbb.org", "manta.com", "superpages.com",
      "citysearch.com", "foursquare.com", "mapquest.com", "hotfrog.com", "brownbook.net",
      "chamberofcommerce.com", "merchantcircle.com", "angieslist.com", "thumbtack.com",
      "homeadvisor.com", "buildzoom.com", "houzz.com", "nextdoor.com", "facebook.com", "google.com/maps",
    ];

    let sent = 0;
    for (const client of clients) {
      try {
        let auditResults = "";
        if (FIRECRAWL_API_KEY) {
          // Search a few key directories for the business
          for (const dir of directories.slice(0, 5)) {
            try {
              const res = await fetch("https://api.firecrawl.dev/v1/search", {
                method: "POST",
                headers: { Authorization: `Bearer ${FIRECRAWL_API_KEY}`, "Content-Type": "application/json" },
                body: JSON.stringify({ query: `site:${dir} "${client.business_name}" ${client.address || ""}`, limit: 1 }),
              });
              const data = await res.json();
              const found = data?.data?.length > 0;
              auditResults += `\n- ${dir}: ${found ? "FOUND ✅" : "NOT FOUND ❌"}${found ? ` — ${data.data[0].url}` : ""}`;
            } catch { auditResults += `\n- ${dir}: COULD NOT CHECK ⚠️`; }
          }
        }

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [{ role: "user", content: `Create a monthly directory audit report for "${client.business_name}" (${client.industry || "business"}).\nAddress: ${client.address || "Not provided"}\nPhone: ${client.phone || "Not provided"}\n\nDirectory scan results:${auditResults || "\nNo directories checked — Firecrawl not configured."}\n\nProvide:\n1. Directory presence summary (found vs missing)\n2. NAP consistency check (Name, Address, Phone)\n3. Priority directories to submit to (with step-by-step instructions)\n4. SEO impact explanation\n\nFormat as clean HTML with h3 headings. Include direct URLs where possible.` }],
          }),
        });
        const aiData = await aiRes.json();
        const report = aiData?.choices?.[0]?.message?.content || "<p>Audit unavailable.</p>";

        if (RESEND_API_KEY) {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({
              from: "M² Directory Audit <matt@mattmichelstraining.com>",
              to: [client.email], bcc: ["matthewmichels4@gmail.com"],
              subject: `Monthly Directory Audit — ${client.business_name}`,
              html: `<div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:20px;background:#1e293b;color:#e2e8f0;border-radius:12px;"><h2 style="color:#e8621a;">📋 Directory Audit Report</h2>${report}<hr style="border-color:#334155;"><p style="color:#64748b;font-size:12px;">Powered by M² Performance</p><div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;">
        <img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" />
        <div style="font-size:13px;color:#94a3b8;">
          <strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952
        </div>
        <img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M² Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" />
      </div></div>`,
            }),
          });
        }

        await sb.from("directory_submitter_clients").update({ audit_count: (client.audit_count || 0) + 1, last_audit_at: new Date().toISOString() }).eq("id", client.id);
        sent++;
      } catch (e) { console.error(`[DIRECTORY] Error for ${client.email}:`, e); }
    }
    return new Response(JSON.stringify({ ok: true, sent }), { status: 200 });
  } catch (e: unknown) { const msg = e instanceof Error ? e.message : String(e); console.error("[DIRECTORY] Fatal:", e); return new Response(JSON.stringify({ error: e.message }), { status: 500 }); }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    const { data: dueDocs } = await sb
      .from("legal_documents")
      .select("document_type, title, next_review_at")
      .lt("next_review_at", new Date().toISOString())
      .eq("status", "approved");

    if (!dueDocs || dueDocs.length === 0) {
      console.log("[LEGAL-REVIEW] No documents due for review.");
      return new Response(JSON.stringify({ message: "No documents due" }), { status: 200 });
    }

    const rows = dueDocs.map((d: any) => `<tr><td style="padding:6px 12px;border:1px solid #ddd;">${d.title}</td><td style="padding:6px 12px;border:1px solid #ddd;">${new Date(d.next_review_at).toLocaleDateString()}</td></tr>`).join("");

    if (RESEND_API_KEY) {
      await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: "M² System <matt@mattmichelstraining.com>",
          to: ["matt@mattmichelstraining.com"],
          bcc: ["matthewmichels4@gmail.com"],
          subject: `⚖️ ${dueDocs.length} Legal Document(s) Due for Review`,
          html: `<p>The following legal documents are past their review date and should be regenerated/reviewed in your Admin → Legal & Compliance panel:</p><table style="border-collapse:collapse;width:100%;margin:16px 0;"><thead><tr><th style="padding:6px 12px;border:1px solid #ddd;text-align:left;">Document</th><th style="padding:6px 12px;border:1px solid #ddd;text-align:left;">Due Date</th></tr></thead><tbody>${rows}</tbody></table><p>Go to Admin → Legal & Compliance → click "Generate" on each to update.</p><p>— M² Automated Legal Review</p>`,
        }),
      });
    }

    return new Response(JSON.stringify({ reviewed: dueDocs.length }), { status: 200 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[LEGAL-REVIEW] Error:", e);
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { generateText } from "../_shared/ai.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";

const JSON_HEADERS = { "Content-Type": "application/json" };

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface UnifiedRecall {
  title: string;
  description: string;
  classification?: string;
  firm?: string;
  distribution?: string;
  url?: string;
  summary?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS_HEADERS });
  }

  try {
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Build yesterday's date for CPSC query
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toISOString().split("T")[0];

    // Fetch FDA and CPSC data in parallel
    const [fdaRes, cpscRes] = await Promise.all([
      fetch("https://api.fda.gov/food/enforcement.json?limit=10&sort=report_date:desc"),
      fetch(`https://www.saferproducts.gov/RestWebServices/Recall?format=json&RecallDateStart=${yesterdayStr}`),
    ]);

    const recalls: UnifiedRecall[] = [];

    if (fdaRes.ok) {
      const fdaData = await fdaRes.json();
      const fdaResults: any[] = fdaData.results || [];
      for (const r of fdaResults) {
        recalls.push({
          title: r.product_description || "FDA Food Recall",
          description: r.reason_for_recall || "",
          classification: r.classification,
          firm: r.recalling_firm,
          distribution: r.distribution_pattern,
        });
      }
    } else {
      console.warn(`[recall-alert-checker] FDA API error: ${fdaRes.status}`);
    }

    if (cpscRes.ok) {
      const cpscData = await cpscRes.json();
      const cpscResults: any[] = Array.isArray(cpscData) ? cpscData : [];
      for (const r of cpscResults) {
        recalls.push({
          title: r.Title || "CPSC Recall",
          description: r.Description || "",
          url: r.URL,
        });
      }
    } else {
      console.warn(`[recall-alert-checker] CPSC API error: ${cpscRes.status}`);
    }

    console.log(`[recall-alert-checker] ${recalls.length} recalls fetched`);

    if (recalls.length === 0) {
      return new Response(JSON.stringify({ recalls: 0, emailsSent: 0 }), {
        headers: { ...JSON_HEADERS, ...CORS_HEADERS },
      });
    }

    // AI-summarize each recall
    const summarizedRecalls = await Promise.all(
      recalls.map(async (recall) => {
        const details = [recall.title, recall.description, recall.firm, recall.distribution]
          .filter(Boolean)
          .join(". ");
        const summary = await generateText(
          `Summarize this product recall in 2 plain-English sentences for a business owner: ${details}`,
          800
        );
        return { ...recall, summary };
      })
    );

    // Fetch active recall alert clients
    const { data: clients, error: clientErr } = await (sb as any)
      .from("recall_alert_clients")
      .select("id, email, name, product_categories")
      .eq("active", true);

    if (clientErr) {
      console.error("[recall-alert-checker] Client query error:", clientErr.message);
      return new Response(JSON.stringify({ error: clientErr.message }), {
        status: 500,
        headers: { ...JSON_HEADERS, ...CORS_HEADERS },
      });
    }

    let emailsSent = 0;

    for (const client of clients || []) {
      const categories: string[] = client.product_categories || [];

      // Match recalls where title/description overlaps client's product categories
      const matched = summarizedRecalls.filter((r) =>
        categories.some(
          (cat) =>
            r.title.toLowerCase().includes(cat.toLowerCase()) ||
            r.description.toLowerCase().includes(cat.toLowerCase())
        )
      );

      if (matched.length === 0) continue;

      const recallCards = matched
        .map(
          (r) => `
        <div style="border:1px solid #e2e8f0;border-radius:8px;padding:16px;margin-bottom:16px;">
          <h3 style="margin:0 0 8px;color:#1e293b;font-size:15px;">${r.title}</h3>
          ${r.classification ? `<p style="margin:0 0 6px;font-size:12px;color:#64748b;">Classification: ${r.classification}</p>` : ""}
          ${r.firm ? `<p style="margin:0 0 6px;font-size:12px;color:#64748b;">Firm: ${r.firm}</p>` : ""}
          <p style="margin:0 0 8px;font-size:14px;color:#334155;">${r.summary || r.description}</p>
          ${r.url ? `<a href="${r.url}" style="color:#e8621a;font-size:13px;">View full recall →</a>` : ""}
        </div>`
        )
        .join("");

      const html = `
        <div style="font-family:sans-serif;max-width:600px;margin:0 auto;">
          <div style="background:#e8621a;padding:24px;border-radius:8px 8px 0 0;">
            <h1 style="color:#fff;margin:0;font-size:22px;">M² Recall Alert</h1>
            <p style="color:#fde8d8;margin:4px 0 0;font-size:14px;">${matched.length} recall${matched.length !== 1 ? "s" : ""} matching your product categories</p>
          </div>
          <div style="background:#fff;padding:24px;border:1px solid #e2e8f0;border-top:none;">
            <p style="color:#334155;margin:0 0 20px;">Hi ${client.name || "there"}, here are the latest product recalls relevant to your business:</p>
            ${recallCards}
          </div>
          <div style="background:#f8fafc;padding:16px;border:1px solid #e2e8f0;border-top:none;border-radius:0 0 8px 8px;font-size:12px;color:#94a3b8;text-align:center;">
            M² Development · Grosse Pointe, MI 48230<br>
            You're receiving this because you subscribed to M² Recall Alerts.
          </div>
        </div>`;

      const emailRes = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: "M² Alerts <matt@mattmichelstraining.com>",
          to: client.email,
          subject: `⚠️ ${matched.length} Product Recall${matched.length !== 1 ? "s" : ""} Affecting Your Business`,
          html,
        }),
      });

      if (emailRes.ok) {
        emailsSent++;
      } else {
        const err = await emailRes.text();
        console.error(`[recall-alert-checker] Resend error for ${client.email}: ${err}`);
      }
    }

    console.log(`[recall-alert-checker] Done — ${recalls.length} recalls, ${emailsSent} emails sent`);

    return new Response(
      JSON.stringify({ recalls: recalls.length, emailsSent }),
      { headers: { ...JSON_HEADERS, ...CORS_HEADERS } }
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[recall-alert-checker] Exception:", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...JSON_HEADERS, ...CORS_HEADERS },
    });
  }
});

// siteredar-self-pitch — daily 11:30am ET
// When a company hits detroitwebagent.com 2+ times in 7 days with no existing client record,
// Apollo lookup → Hunter email → personalized 3-sentence email via Haiku → send via Resend.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { apolloOrganizationSearch } from "../_shared/apollo.ts";
import { hunterFindEmail } from "../_shared/hunter.ts";
import { generateWithHaiku } from "../_shared/opus.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const DWA_DOMAIN = "detroitwebagent.com";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  let pitched = 0, skipped = 0;

  try {
    // Find companies with 2+ visits to DWA site in last 7 days
    const { data: visitors } = await sb
      .from("crm_visitor_events")
      .select("company_name, company_domain, page_path, enrichment_data")
      .eq("site_domain", DWA_DOMAIN)
      .gte("created_at", sevenDaysAgo)
      .not("company_name", "is", null)
      .order("created_at", { ascending: false });

    if (!visitors?.length) {
      return new Response(JSON.stringify({ ok: true, pitched: 0, note: "no visitors" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Count visits per company, pick those with 2+
    const counts: Record<string, { name: string; domain: string | null; pages: string[] }> = {};
    for (const v of visitors) {
      const key = (v.company_domain || v.company_name || "").toLowerCase();
      if (!key) continue;
      if (!counts[key]) counts[key] = { name: v.company_name, domain: v.company_domain, pages: [] };
      if (v.page_path && !counts[key].pages.includes(v.page_path)) {
        counts[key].pages.push(v.page_path);
      }
    }
    const qualified = Object.values(counts).filter((c) => c.pages.length >= 2 || visitors.filter((v) =>
      (v.company_domain || v.company_name || "").toLowerCase() === (c.domain || c.name || "").toLowerCase()
    ).length >= 2);

    for (const company of qualified.slice(0, 10)) {
      try {
        // Skip if already a client
        const { data: existing } = await sb
          .from("field_crm_clients")
          .select("id")
          .or(`domain.eq.${company.domain},email.ilike.%@${company.domain}%`)
          .maybeSingle();
        if (existing) { skipped++; continue; }

        // Skip if already pitched in last 30 days
        const { data: recentOutreach } = await sb
          .from("outreach_leads")
          .select("id")
          .eq("source", "siteradar_self")
          .ilike("company_name", company.name)
          .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
          .maybeSingle();
        if (recentOutreach) { skipped++; continue; }

        // Apollo lookup for owner email
        let ownerEmail: string | null = null;
        let ownerName: string | null = null;

        const apolloOrg = await apolloOrganizationSearch(company.name).catch(() => null);
        if (apolloOrg?.organization?.primary_domain) {
          const hunterResult = await hunterFindEmail(apolloOrg.organization.primary_domain).catch(() => null);
          if (hunterResult?.email) {
            ownerEmail = hunterResult.email;
            ownerName = hunterResult.first_name ? `${hunterResult.first_name}` : null;
          }
        }

        if (!ownerEmail && company.domain) {
          const hunterResult = await hunterFindEmail(company.domain).catch(() => null);
          if (hunterResult?.email) {
            ownerEmail = hunterResult.email;
            ownerName = hunterResult.first_name || null;
          }
        }

        if (!ownerEmail) { skipped++; continue; }

        // Determine most relevant product based on pages visited
        const pages = company.pages.join(" ");
        let product = "our contractor growth platform";
        let productHook = "We help local service businesses automate their customer outreach";
        if (pages.includes("techalert") || pages.includes("talent-radar") || pages.includes("hire")) {
          product = "TechAlert";
          productHook = "TechAlert monitors signals to find licensed trades workers before they post on Indeed";
        } else if (pages.includes("mortgage") || pages.includes("radar")) {
          product = "Mortgage Radar";
          productHook = "Mortgage Radar surfaces FSBO, estate sale, and divorce leads for loan officers before they hit Zillow";
        } else if (pages.includes("dead-lead") || pages.includes("reactivat")) {
          product = "Dead Lead Reactivation";
          productHook = "We text contractors' old unresponsive leads and only charge $50 when someone replies";
        } else if (pages.includes("field") || pages.includes("fielddesk") || pages.includes("dispatch")) {
          product = "FieldDesk";
          productHook = "FieldDesk handles dispatch, job tracking, and tech mobile apps for field service businesses";
        }

        const firstName = ownerName || "there";
        const prompt = `Write a 3-sentence cold email (no subject line, no greeting, no sign-off) from Matt Michels at Detroit Web Agency to ${firstName} at ${company.name}.

Context: They visited ${DWA_DOMAIN} ${company.pages.length >= 2 ? "multiple times" : "recently"} and looked at pages related to ${product}.

Product context: ${productHook}.

The email should:
1. Open with a specific, intelligent reference to ${company.name} — show you know something about their business (make a reasonable inference based on the company name and industry)
2. Connect what they were researching to a specific pain point their type of business faces
3. End with one soft, direct ask — "Worth a 10-minute call this week?"

Write ONLY the 3 email sentences. No subject line, no greeting, no sign-off.`;

        const body = await generateWithHaiku(prompt, 200).catch(() =>
          `I noticed ${company.name} checked out our ${product} page a couple times this week — figured you were looking for a solution to [specific pain]. ${productHook}. Worth a 10-minute call this week?`
        );

        const subject = `${company.name} + ${product}`;

        // Send via Resend
        await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "Matt Michels — Detroit Web Agency <matt@detroitwebagent.com>",
            to: [ownerEmail],
            bcc: ["matt@detroitwebagent.com"],
            subject,
            text: `${body}\n\n— Matt Michels\nDetroit Web Agency\nmatt@detroitwebagent.com\n(313) 992-1219`,
          }),
        });

        // Log to outreach_leads
        await sb.from("outreach_leads" as any).insert({
          company_name: company.name,
          owner_email: ownerEmail,
          owner_name: ownerName || null,
          website: company.domain ? `https://${company.domain}` : null,
          source: "siteradar_self",
          outreach_status: "contacted",
          enriched_at: new Date().toISOString(),
        }).catch(() => {});

        pitched++;
        await new Promise((r) => setTimeout(r, 500));
      } catch (e) {
        console.error("[siteredar-self-pitch] company error:", (e as Error).message);
        skipped++;
      }
    }

    await sb.from("agent_heartbeats").upsert({
      agent_name: "siteredar-self-pitch",
      last_beat: new Date().toISOString(),
      status: "ok",
      metadata: { pitched, skipped, qualified: qualified.length },
    }, { onConflict: "agent_name" });

    return new Response(JSON.stringify({ ok: true, pitched, skipped, qualified: qualified.length }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ ok: false, error: msg }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

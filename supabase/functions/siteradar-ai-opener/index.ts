// SiteRadar AI Cold Email Drafter — Opus-generated personalized opener
// referencing the exact pages a visitor browsed.
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { generateWithOpus } from "../_shared/opus.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const { client_id, company_name } = await req.json();
    if (!client_id || !company_name) {
      return new Response(JSON.stringify({ error: "client_id + company_name required" }), {
        status: 400, headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: client } = await sb
      .from("field_crm_clients")
      .select("business_name, owner_name")
      .eq("id", client_id)
      .maybeSingle();
    const { data: events } = await sb
      .from("crm_visitor_events")
      .select("page_visited, created_at, city, enrichment_data")
      .eq("client_id", client_id)
      .eq("company_name", company_name)
      .order("created_at", { ascending: false })
      .limit(20);

    const pages = [...new Set((events || []).map((e: any) => e.page_visited).filter(Boolean))];
    const visits = events?.length || 0;
    const city = events?.[0]?.city;

    const prompt = `Write a short, personal cold email (under 90 words) from ${client?.owner_name || "me"} at ${client?.business_name || "our company"} to a contact at ${company_name}${city ? " in " + city : ""}.

They've visited our site ${visits} times. Pages they browsed:
${pages.slice(0, 6).map((p) => `- ${p}`).join("\n")}

Reference one specific page they spent time on. Open with curiosity, not a pitch. End with a low-friction ask (15-min call or one specific question). No subject line. No salutation block. Just the body. Conversational, no fluff.`;

    const draft = await generateWithOpus(prompt, "You write cold outreach openers that don't sound like cold outreach.", 400);
    return new Response(JSON.stringify({ draft }), {
      status: 200, headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

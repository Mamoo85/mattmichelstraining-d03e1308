// dead-lead-intake — public POST endpoint
// Contractor submits their dead lead list from the self-serve intake page.
// Creates campaign + contacts, notifies Matt via SMS.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
const SITE_URL = Deno.env.get("SITE_URL") || "https://detroitwebagent.com";
const FREE_TIER_LIMIT = 10; // max contacts allowed on the free trial

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};


// ── Items 34 & 36: Twilio Lookup v2 — phone carrier classification ─────────────
async function twilioCarrierLookup(phone: string): Promise<{ type: string; isDncRisk: boolean }> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) return { type: "unknown", isDncRisk: false };
  try {
    const res = await fetch(
      `https://lookups.twilio.com/v2/PhoneNumbers/${encodeURIComponent(phone)}?Fields=line_type_intelligence`,
      {
        headers: { Authorization: `Basic ${btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`)}` },
        signal: AbortSignal.timeout(5000),
      }
    );
    if (!res.ok) return { type: "unknown", isDncRisk: false };
    const data = await res.json();
    const type: string = data?.line_type_intelligence?.type || "unknown";
    // Landlines are higher DNC-risk (can be on National DNC Registry)
    return { type, isDncRisk: type === "landline" };
  } catch { return { type: "unknown", isDncRisk: false }; }
}

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === "1") return `+${digits}`;
  return raw;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: CORS });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  try {
    const body = await req.json();
    const {
      business_name,
      owner_name,
      phone,
      email,
      trade,
      leads,
      campaign_name,
      google_review_link,
    } = body;

    if (!business_name || !phone || !email || !trade || !leads?.length) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    const contractorPhone = normalizePhone(phone);

    // Find or create contractor_clients record
    let contractorId: string;
    let freeTierUsed = false;
    let billingActive = false;

    const { data: existing } = await sb
      .from("contractor_clients" as any)
      .select("id, free_tier_used, dead_lead_billing_active")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (existing?.id) {
      contractorId = existing.id;
      freeTierUsed = existing.free_tier_used ?? false;
      billingActive = existing.dead_lead_billing_active ?? false;
      // Update name/phone/biz in case they changed
      await sb.from("contractor_clients" as any).update({
        business_name,
        name: owner_name || business_name,
        phone: contractorPhone,
        trade,
        ...(google_review_link ? { google_review_link } : {}),
      }).eq("id", contractorId);
    } else {
      const { data: newContractor, error: insertErr } = await sb
        .from("contractor_clients" as any)
        .insert({
          business_name,
          name: owner_name || business_name,
          phone: contractorPhone,
          email: email.toLowerCase().trim(),
          trade,
          city: "Metro Detroit",
          state: "MI",
          active: false,
          ...(google_review_link ? { google_review_link } : {}),
        })
        .select("id, free_tier_used, dead_lead_billing_active")
        .single();
      if (insertErr || !newContractor) {
        throw new Error(`contractor insert: ${insertErr?.message}`);
      }
      contractorId = newContractor.id;
      freeTierUsed = false;
      billingActive = false;
    }

    // Gate: if free trial already used and no billing, reject with CTA
    if (freeTierUsed && !billingActive) {
      const billingUrl = `${SITE_URL}/dead-lead-intake?billing=1&cid=${contractorId}`;
      return new Response(
        JSON.stringify({
          error: "free_tier_exhausted",
          message: `Your free trial (${FREE_TIER_LIMIT} leads) has been used. Add a card to continue — you only pay $50 when a lead replies YES.`,
          billing_url: billingUrl,
        }),
        { status: 402, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Parse leads from textarea lines: "phone" or "phone, name" or "phone, name, YYYY-MM-DD"
    // last_contact_date is required for TCPA EBR (18-month window). If contractor
    // doesn't provide one, default to today (covers fresh quotes); old leads must
    // include the actual quote date or they'll be filtered out by the drip.
    const todayISO = new Date().toISOString().split("T")[0];
    const eighteenMonthsAgo = new Date(Date.now() - 548 * 24 * 60 * 60 * 1000)
      .toISOString().split("T")[0];

    const parsedLeads: { phone: string; name: string | null; last_contact_date: string }[] = [];
    let tcpaScrubbed = 0;
    for (const line of leads) {
      const parts = (line as string).split(",").map((s: string) => s.trim()).filter(Boolean);
      if (!parts[0]) continue;
      const leadPhone = normalizePhone(parts[0]);
      const leadName = parts[1] || null;
      const rawDate = parts[2] || todayISO;
      const lastContactDate = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) ? rawDate : todayISO;
      // TCPA: skip anything older than 18 months at intake
      if (lastContactDate < eighteenMonthsAgo) {
        tcpaScrubbed++;
        continue;
      }
      parsedLeads.push({ phone: leadPhone, name: leadName, last_contact_date: lastContactDate });
    }

    // Items 34 & 36: carrier lookup on first 5 leads
    const carrierMap: Record<string, { type: string; isDncRisk: boolean }> = {};
    for (const l of parsedLeads.slice(0, 5)) {
      carrierMap[l.phone] = await twilioCarrierLookup(l.phone);
    }

    if (parsedLeads.length === 0) {
      return new Response(
        JSON.stringify({ error: "No valid phone numbers found", tcpa_scrubbed: tcpaScrubbed }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // On free trial: cap at FREE_TIER_LIMIT leads
    const isFreeTrial = !freeTierUsed && !billingActive;
    const effectiveLeads = isFreeTrial ? parsedLeads.slice(0, FREE_TIER_LIMIT) : parsedLeads;

    // Create campaign
    const campName = campaign_name || `${business_name} — ${new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
    const { data: campaign, error: campErr } = await sb
      .from("dead_lead_campaigns" as any)
      .insert({
        contractor_id: contractorId,
        name: campName,
        trade,
        status: "active",
        is_free_trial: isFreeTrial,
      })
      .select("id")
      .single();
    if (campErr || !campaign) {
      throw new Error(`campaign insert: ${campErr?.message}`);
    }

    // Bulk insert contacts (capped if free trial)
    const contactRows = effectiveLeads.map((l) => ({
      campaign_id: campaign.id,
      contractor_id: contractorId,
      phone: l.phone,
      name: l.name,
      last_contact_date: l.last_contact_date,
      status: "pending",
      phone_carrier_type: carrierMap[l.phone]?.type || null,
      is_dnc_risk: carrierMap[l.phone]?.isDncRisk || false,
    }));
    const { error: contactErr } = await sb
      .from("dead_lead_contacts" as any)
      .insert(contactRows);
    if (contactErr) {
      throw new Error(`contacts insert: ${contactErr.message}`);
    }

    // Mark free tier as used so next submission requires billing
    if (isFreeTrial) {
      await sb.from("contractor_clients" as any)
        .update({ free_tier_used: true })
        .eq("id", contractorId);
    }

    // SMS Matt
    const trialNote = isFreeTrial ? ` (FREE TRIAL — ${effectiveLeads.length}/${parsedLeads.length} leads loaded)` : "";
    await sendSMS(
      ADMIN_PHONE,
      TWILIO_PHONE,
      `♻️ New dead lead campaign submitted!\n${business_name} (${trade})\n${effectiveLeads.length} contacts ready to drip.${trialNote}\nApprove: ${SITE_URL}/admin`,
      "dead_lead_reactivation"
    );

    console.log(`[dead-lead-intake] contractor=${contractorId} campaign=${campaign.id} contacts=${effectiveLeads.length} free_trial=${isFreeTrial}`);

    return new Response(
      JSON.stringify({
        ok: true,
        campaign_id: campaign.id,
        contractor_id: contractorId,
        contacts_added: effectiveLeads.length,
        is_free_trial: isFreeTrial,
        leads_submitted: parsedLeads.length,
        free_tier_limit: FREE_TIER_LIMIT,
      }),
      { status: 200, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[dead-lead-intake]", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...CORS, "Content-Type": "application/json" } }
    );
  }
});

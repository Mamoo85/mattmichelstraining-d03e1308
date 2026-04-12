// dead-lead-intake — public POST endpoint
// Contractor submits their dead lead list from the self-serve intake page.
// Creates campaign + contacts, notifies Matt via SMS.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_PHONE = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
const SITE_URL = Deno.env.get("SITE_URL") || "https://detroitwebagent.com";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "content-type",
};

function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits[0] === "1") return `+${digits}`;
  return raw;
}

// TCPA: EBR exemption expires 18 months after last customer inquiry.
function isTcpaExpired(dateStr: string | null, uploadedAt: Date): boolean {
  const cutoff = new Date(uploadedAt);
  cutoff.setMonth(cutoff.getMonth() - 18);
  const ref = dateStr ? new Date(dateStr) : null;
  return ref !== null && ref < cutoff;
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
      leads,           // string[] — raw lines from textarea
      campaign_name,
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
    const { data: existing } = await sb
      .from("contractor_clients" as any)
      .select("id")
      .eq("email", email.toLowerCase().trim())
      .maybeSingle();

    if (existing?.id) {
      contractorId = existing.id;
      // Update name/phone/biz in case they changed
      await sb.from("contractor_clients" as any).update({
        business_name,
        name: owner_name || business_name,
        phone: contractorPhone,
        trade,
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
        })
        .select("id")
        .single();
      if (insertErr || !newContractor) {
        throw new Error(`contractor insert: ${insertErr?.message}`);
      }
      contractorId = newContractor.id;
    }

    // Parse leads from textarea lines: "phone", "phone, name", or "phone, name, YYYY-MM-DD"
    // Leads with a date older than 18 months are scrubbed (TCPA EBR expiry).
    const now = new Date();
    const parsedLeads: { phone: string; name: string | null; last_contact_date: string | null }[] = [];
    let scrubbedCount = 0;
    for (const line of leads) {
      const parts = (line as string).split(",").map((s: string) => s.trim()).filter(Boolean);
      if (!parts[0]) continue;
      const leadPhone = normalizePhone(parts[0]);
      const leadName = parts[1] || null;
      const dateStr = parts[2] && /^\d{4}-\d{2}-\d{2}$/.test(parts[2]) ? parts[2] : null;
      if (isTcpaExpired(dateStr, now)) {
        scrubbedCount++;
        continue; // Drop — outside 18-month EBR window
      }
      parsedLeads.push({ phone: leadPhone, name: leadName, last_contact_date: dateStr });
    }

    if (parsedLeads.length === 0) {
      return new Response(
        JSON.stringify({ error: scrubbedCount > 0 ? `All ${scrubbedCount} leads are older than 18 months (TCPA). Upload more recent contacts.` : "No valid phone numbers found" }),
        { status: 400, headers: { ...CORS, "Content-Type": "application/json" } }
      );
    }

    // Create campaign
    const campName = campaign_name || `${business_name} — ${new Date().toLocaleDateString("en-US", { month: "short", year: "numeric" })}`;
    const { data: campaign, error: campErr } = await sb
      .from("dead_lead_campaigns" as any)
      .insert({
        contractor_id: contractorId,
        name: campName,
        trade,
        status: "active",
      })
      .select("id")
      .single();
    if (campErr || !campaign) {
      throw new Error(`campaign insert: ${campErr?.message}`);
    }

    // Bulk insert contacts
    const contactRows = parsedLeads.map((l) => ({
      campaign_id: campaign.id,
      contractor_id: contractorId,
      phone: l.phone,
      name: l.name,
      status: "pending",
    }));
    const { error: contactErr } = await sb
      .from("dead_lead_contacts" as any)
      .insert(contactRows);
    if (contactErr) {
      throw new Error(`contacts insert: ${contactErr.message}`);
    }

    // SMS Matt
    await sendSMS(
      ADMIN_PHONE,
      TWILIO_PHONE,
      `♻️ New dead lead campaign submitted!\n${business_name} (${trade})\n${parsedLeads.length} contacts ready to drip.\nApprove: ${SITE_URL}/admin`,
      "dead_lead_reactivation"
    );

    console.log(`[dead-lead-intake] contractor=${contractorId} campaign=${campaign.id} contacts=${parsedLeads.length}`);

    return new Response(
      JSON.stringify({
        ok: true,
        campaign_id: campaign.id,
        contractor_id: contractorId,
        contacts_added: parsedLeads.length,
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

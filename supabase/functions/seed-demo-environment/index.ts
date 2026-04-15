import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const DEMO_CANDIDATES = [
  {
    full_name: "John Mitchell",
    name: "John Mitchell",
    license_type: "boiler_operator",
    license_number: "DEMO-BO-4821",
    license_status: "active",
    license_expiry: "2027-06-15",
    city: "Dearborn",
    state: "MI",
    availability_score: 9,
    availability_label: "High Availability",
    score_reason: "License renewing soon, updated LinkedIn profile, no current employer listed",
    qualifications_summary: "12 years boiler operation experience. High-pressure steam certified. Previous: Ford Rouge Complex, Henry Ford Health. ASME Section I qualified.",
    hiring_recommendation: "Top candidate — actively looking, strong industrial background, available immediately.",
    current_employer: null,
    current_title: "Senior Boiler Operator",
    years_experience: "12",
    phone: "+13135550101",
    email: "demo.john.mitchell@example.com",
    source: "demo_seed",
    status: "active",
    is_demo_record: true,
  },
  {
    full_name: "Sarah Chen",
    name: "Sarah Chen",
    license_type: "hvac_tech",
    license_number: "DEMO-HV-7293",
    license_status: "active",
    license_expiry: "2027-09-01",
    city: "Warren",
    state: "MI",
    availability_score: 8,
    availability_label: "High Availability",
    score_reason: "Recently completed additional EPA 608 certification, profile shows interest in new opportunities",
    qualifications_summary: "8 years HVAC residential & commercial. EPA 608 Universal. Carrier & Trane factory trained. R-410A certified.",
    hiring_recommendation: "Strong hire — dual residential/commercial experience rare in this market.",
    current_employer: "Metro Comfort Systems",
    current_title: "Lead HVAC Technician",
    years_experience: "8",
    phone: "+13135550102",
    email: "demo.sarah.chen@example.com",
    source: "demo_seed",
    status: "active",
    is_demo_record: true,
  },
  {
    full_name: "Marcus Williams",
    name: "Marcus Williams",
    license_type: "plumber",
    license_number: "DEMO-PL-3847",
    license_status: "active",
    license_expiry: "2026-12-31",
    city: "Southfield",
    state: "MI",
    availability_score: 7,
    availability_label: "Possible Availability",
    score_reason: "License expiring this year — may be exploring options before renewal deadline",
    qualifications_summary: "15 years master plumber. Backflow prevention certified. Medical gas installer (ASSE 6010). Commercial & residential.",
    hiring_recommendation: "Worth pursuing — medical gas certification is highly valued and hard to find.",
    current_employer: "Great Lakes Plumbing Co",
    current_title: "Master Plumber",
    years_experience: "15",
    phone: "+13135550103",
    email: "demo.marcus.williams@example.com",
    source: "demo_seed",
    status: "active",
    is_demo_record: true,
  },
  {
    full_name: "Lisa Rodriguez",
    name: "Lisa Rodriguez",
    license_type: "rn",
    license_number: "DEMO-RN-6194",
    license_status: "active",
    license_expiry: "2027-03-15",
    city: "Troy",
    state: "MI",
    availability_score: 8,
    availability_label: "High Availability",
    score_reason: "NPI registry shows recent practice address change — possible job transition",
    qualifications_summary: "10 years RN. BSN from Wayne State. ICU & med-surg experience. BLS/ACLS current. Previous: Beaumont, Henry Ford.",
    hiring_recommendation: "Excellent candidate — ICU background with major health system experience.",
    current_employer: null,
    current_title: "Registered Nurse",
    years_experience: "10",
    phone: "+13135550104",
    email: "demo.lisa.rodriguez@example.com",
    source: "demo_seed",
    status: "active",
    is_demo_record: true,
  },
  {
    full_name: "David Kowalski",
    name: "David Kowalski",
    license_type: "electrician",
    license_number: "DEMO-EL-5520",
    license_status: "active",
    license_expiry: "2027-11-30",
    city: "Livonia",
    state: "MI",
    availability_score: 6,
    availability_label: "Monitor",
    score_reason: "Stable employment but license shows recent continuing education — staying sharp",
    qualifications_summary: "20 years journeyman electrician. Industrial controls & PLC programming. Allen-Bradley certified. Arc flash qualified.",
    hiring_recommendation: "Long-shot but high value — industrial controls expertise commands premium rates.",
    current_employer: "Stellantis (Warren Truck Assembly)",
    current_title: "Industrial Electrician",
    years_experience: "20",
    phone: "+13135550105",
    email: "demo.david.kowalski@example.com",
    source: "demo_seed",
    status: "active",
    is_demo_record: true,
  },
];

const DEMO_CONTRACTOR_LEADS = [
  { name: "John Doe", phone: "+13135550201", email: "demo.johndoe@example.com", message: "Need furnace replaced ASAP, house is freezing", project_type: "HVAC Replacement", contact_preference: "call", source: "demo_seed", status: "new", is_demo_record: true },
  { name: "Jane Smith", phone: "+13135550202", email: "demo.janesmith@example.com", message: "Bathroom remodel, need new plumbing", project_type: "Plumbing", contact_preference: "text", source: "demo_seed", status: "new", is_demo_record: true },
  { name: "Robert Johnson", phone: "+13135550203", email: "demo.rjohnson@example.com", message: "Panel upgrade from 100A to 200A", project_type: "Electrical", contact_preference: "email", source: "demo_seed", status: "new", is_demo_record: true },
  { name: "Maria Garcia", phone: "+13135550204", email: "demo.mgarcia@example.com", message: "AC not cooling, 10 year old Carrier unit", project_type: "HVAC Repair", contact_preference: "call", source: "demo_seed", status: "new", is_demo_record: true },
  { name: "Tom Wilson", phone: "+13135550205", email: "demo.twilson@example.com", message: "Boiler making banging noise, commercial building", project_type: "Boiler Repair", contact_preference: "text", source: "demo_seed", status: "new", is_demo_record: true },
];

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  try {
    const { action } = await req.json();
    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    if (action === "clear") {
      // Remove all demo records
      const [r1, r2, r3, r4] = await Promise.all([
        sb.from("hire_alert_candidates").delete().eq("is_demo_record", true),
        sb.from("contractor_leads").delete().eq("is_demo_record", true),
        sb.from("dead_lead_contacts").delete().eq("is_demo_record", true),
        sb.from("dead_lead_campaigns").delete().eq("is_demo_record", true),
      ]);
      return new Response(JSON.stringify({ success: true, action: "cleared" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Seed demo data
    // 1. TechAlert candidates
    const { error: candErr } = await sb.from("hire_alert_candidates").upsert(
      DEMO_CANDIDATES,
      { onConflict: "license_number", ignoreDuplicates: false }
    );
    if (candErr) console.error("[seed] candidates:", candErr.message);

    // 2. Contractor leads
    const { error: leadErr } = await sb.from("contractor_leads").insert(
      DEMO_CONTRACTOR_LEADS
    );
    if (leadErr) console.error("[seed] leads:", leadErr.message);

    // 3. Dead lead campaign + contacts
    const { data: campaign, error: campErr } = await sb.from("dead_lead_campaigns").insert({
      contractor_id: "00000000-0000-0000-0000-000000000000",
      contractor_name: "Demo HVAC Company",
      contractor_phone: "+13135550301",
      status: "active",
      is_demo_record: true,
    }).select("id").single();

    if (campaign && !campErr) {
      await sb.from("dead_lead_contacts").insert([
        { campaign_id: campaign.id, name: "Old Customer A", phone: "+13135550301", status: "pending", is_demo_record: true },
        { campaign_id: campaign.id, name: "Old Customer B", phone: "+13135550302", status: "pending", is_demo_record: true },
        { campaign_id: campaign.id, name: "Old Customer C", phone: "+13135550303", status: "replied_positive", is_demo_record: true },
      ]);
    }

    return new Response(JSON.stringify({
      success: true,
      action: "seeded",
      counts: { candidates: DEMO_CANDIDATES.length, leads: DEMO_CONTRACTOR_LEADS.length, dead_lead_contacts: 3 },
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[seed-demo-environment]", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

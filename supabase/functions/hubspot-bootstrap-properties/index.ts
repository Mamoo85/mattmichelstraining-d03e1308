// One-time bootstrap: creates DWA custom properties in HubSpot
// Run via: curl -X POST <function-url>
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GATEWAY = "https://connector-gateway.lovable.dev/hubspot";

interface PropDef {
  object: "contacts" | "companies" | "deals";
  group: string;
  name: string;
  label: string;
  type: "string" | "number" | "enumeration" | "datetime";
  fieldType: "text" | "number" | "select" | "date";
  options?: { label: string; value: string }[];
}

const PROPERTIES: PropDef[] = [
  // Contact / Company signal source
  { object: "contacts", group: "contactinformation", name: "dwa_signal_source", label: "DWA Signal Source", type: "enumeration", fieldType: "select",
    options: [
      { label: "TechAlert", value: "techalert" },
      { label: "Mortgage Radar", value: "mortgage_radar" },
      { label: "Trade Radar", value: "trade_radar" },
      { label: "Marketplace", value: "marketplace" },
      { label: "Site Radar", value: "site_radar" },
      { label: "Stripe Checkout", value: "stripe_checkout" },
      { label: "Inbound Form", value: "inbound_form" },
    ] },
  { object: "companies", group: "companyinformation", name: "dwa_signal_source", label: "DWA Signal Source", type: "string", fieldType: "text" },
  { object: "contacts", group: "contactinformation", name: "dwa_lead_score", label: "DWA Lead Score", type: "number", fieldType: "number" },
  { object: "contacts", group: "contactinformation", name: "dwa_signal_date", label: "DWA Signal Date", type: "datetime", fieldType: "date" },

  // Deal properties for Mortgage Radar
  { object: "deals", group: "dealinformation", name: "dwa_property_address", label: "Property Address", type: "string", fieldType: "text" },
  { object: "deals", group: "dealinformation", name: "dwa_property_zip", label: "Property ZIP", type: "string", fieldType: "text" },
  { object: "deals", group: "dealinformation", name: "dwa_signal_type", label: "Signal Type", type: "string", fieldType: "text" },
  { object: "deals", group: "dealinformation", name: "dwa_product", label: "DWA Product", type: "string", fieldType: "text" },
];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const HUBSPOT_API_KEY = Deno.env.get("HUBSPOT_API_KEY");
  if (!LOVABLE_API_KEY) return json({ error: "LOVABLE_API_KEY missing" }, 500);
  if (!HUBSPOT_API_KEY) return json({ error: "HUBSPOT_API_KEY missing" }, 500);

  const headers = {
    "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    "X-Connection-Api-Key": HUBSPOT_API_KEY,
    "Content-Type": "application/json",
  };

  const results: Array<{ object: string; name: string; status: string; detail?: unknown }> = [];

  for (const p of PROPERTIES) {
    const body: Record<string, unknown> = {
      name: p.name,
      label: p.label,
      type: p.type,
      fieldType: p.fieldType,
      groupName: p.group,
    };
    if (p.options) body.options = p.options.map((o, i) => ({ ...o, displayOrder: i, hidden: false }));

    const res = await fetch(`${GATEWAY}/crm/v3/properties/${p.object}`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));

    if (res.ok) {
      results.push({ object: p.object, name: p.name, status: "created" });
    } else if (res.status === 409 || JSON.stringify(data).includes("already exists")) {
      results.push({ object: p.object, name: p.name, status: "exists" });
    } else {
      results.push({ object: p.object, name: p.name, status: "error", detail: data });
    }
  }

  return json({ ok: true, results }, 200);
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

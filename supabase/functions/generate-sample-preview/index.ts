import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY") || "";
const HIBP_API_KEY = Deno.env.get("HIBP_API_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function aiGenerate(prompt: string): Promise<string> {
  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
    }),
  });
  if (!res.ok) throw new Error(`AI error: ${res.status}`);
  const data = await res.json();
  return data?.choices?.[0]?.message?.content?.trim() || "";
}

async function generatePetMemorialSample(overrides: Record<string, string>) {
  const petName = overrides.pet_name || "Buddy";
  const species = overrides.pet_species || "Dog";
  const breed = overrides.pet_breed || "Golden Retriever";
  const ownerName = overrides.owner_name || "Matt";
  const memories = overrides.memories || "Loved fetch at the park, always happy, best training buddy";

  const prompt = `You are a compassionate writer creating a heartfelt pet memorial. Details:
Pet Name: ${petName}
Species: ${species}
Breed: ${breed}
Owner: ${ownerName}
Memories: ${memories}

Create a memorial as JSON with exactly these fields:
{
  "poem": "A 10-14 line rhyming poem from the pet's perspective, warm not tragic. Use the pet's name.",
  "tribute": "Three paragraphs celebrating the pet's personality, honoring memories, and a warm closing.",
  "social_caption": "2-3 sentences for social media. Warm and genuine with the pet's name."
}

Respond with ONLY valid JSON.`;

  const text = await aiGenerate(prompt);
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("Failed to parse AI response");
  const parsed = JSON.parse(match[0]);

  return {
    type: "pet_memorial",
    pet_name: petName,
    species,
    breed,
    owner_name: ownerName,
    poem: parsed.poem,
    tribute: parsed.tribute,
    social_caption: parsed.social_caption,
  };
}

async function generateCredentialAuditSample(overrides: Record<string, string>) {
  const companyName = overrides.company_name || "M2 Development";
  const testEmails = ["test@example.com"];

  const results: Array<{
    email: string;
    breach_count: number;
    severity: string;
    breaches: Array<{ name: string; date: string; data_classes: string[] }>;
  }> = [];

  for (const email of testEmails) {
    try {
      const url = `https://haveibeenpwned.com/api/v3/breachedaccount/${encodeURIComponent(email)}?truncateResponse=false`;
      const res = await fetch(url, {
        headers: {
          "hibp-api-key": HIBP_API_KEY,
          "User-Agent": "M2-Employee-Credential-Audit/1.0",
        },
      });

      if (res.status === 404) {
        results.push({ email, breach_count: 0, severity: "clean", breaches: [] });
      } else if (res.ok) {
        const data = await res.json();
        const breaches = (data || []).slice(0, 5).map((b: any) => ({
          name: b.Name || "",
          date: b.BreachDate || "",
          data_classes: (b.DataClasses || []).slice(0, 4),
        }));
        const hasPw = breaches.some((b: any) => b.data_classes.some((d: string) => d.toLowerCase().includes("password")));
        results.push({
          email,
          breach_count: data.length,
          severity: hasPw ? "critical" : "medium",
          breaches,
        });
      } else {
        results.push({ email, breach_count: 0, severity: "unknown", breaches: [] });
      }
    } catch {
      results.push({ email, breach_count: 0, severity: "error", breaches: [] });
    }
  }

  const totalBreaches = results.reduce((a, r) => a + r.breach_count, 0);
  const criticalCount = results.filter(r => r.severity === "critical").length;

  return {
    type: "employee_credential_audit",
    company_name: companyName,
    emails_scanned: testEmails.length,
    total_breaches_found: totalBreaches,
    critical_accounts: criticalCount,
    results,
    summary: `Scanned ${testEmails.length} email(s) for ${companyName}. Found ${totalBreaches} breach(es) across known data breaches. ${criticalCount > 0 ? `⚠️ ${criticalCount} account(s) have passwords exposed — immediate action recommended.` : "No critical password exposures detected."}`,
    recommendation: totalBreaches > 0
      ? "We recommend enforcing password resets for all affected accounts and enabling multi-factor authentication company-wide."
      : "No breaches found! Great security posture. Consider scheduling quarterly re-scans.",
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { product, overrides = {} } = await req.json();

    let result: any;
    if (product === "pet_memorial_subscription") {
      result = await generatePetMemorialSample(overrides);
    } else if (product === "employee_credential_audit") {
      result = await generateCredentialAuditSample(overrides);
    } else {
      return new Response(JSON.stringify({ error: `Unknown product: ${product}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[generate-sample-preview]", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

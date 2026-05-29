// apollo-test-enrich — quick admin tool to validate Apollo key quality.
// Hits 3 Apollo endpoints (org enrich, people match, decision-maker search) and
// returns the raw output so Matt can judge data quality.
//
// GET  /functions/v1/apollo-test-enrich?domain=acme.com&company=Acme%20Inc&first=John&last=Doe
// POST /functions/v1/apollo-test-enrich  { domain, company, first_name, last_name, email? }

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APOLLO_API_KEY = Deno.env.get("APOLLO_API_KEY") || "";

interface TestInput {
  domain?: string;
  company?: string;
  first_name?: string;
  last_name?: string;
  email?: string;
}

async function callApollo(label: string, url: string, init: RequestInit) {
  const t0 = Date.now();
  try {
    const res = await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(10_000),
    });
    const text = await res.text();
    let json: unknown = null;
    try { json = JSON.parse(text); } catch { /* keep text */ }
    return {
      label,
      status: res.status,
      ok: res.ok,
      latency_ms: Date.now() - t0,
      response: json ?? text,
    };
  } catch (e) {
    return {
      label,
      status: 0,
      ok: false,
      latency_ms: Date.now() - t0,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  if (!APOLLO_API_KEY) {
    return new Response(
      JSON.stringify({ ok: false, error: "APOLLO_API_KEY not set in environment" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  let input: TestInput = {};
  if (req.method === "POST") {
    input = await req.json().catch(() => ({}));
  } else {
    const u = new URL(req.url);
    input = {
      domain: u.searchParams.get("domain") || undefined,
      company: u.searchParams.get("company") || undefined,
      first_name: u.searchParams.get("first") || u.searchParams.get("first_name") || undefined,
      last_name: u.searchParams.get("last") || u.searchParams.get("last_name") || undefined,
      email: u.searchParams.get("email") || undefined,
    };
  }

  const { domain, company, first_name, last_name, email } = input;

  if (!domain && !company && !email) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Provide at least one of: domain, company, email",
        usage: "GET ?domain=acme.com&company=Acme&first=John&last=Doe",
      }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  const tests: Promise<unknown>[] = [];

  // Test 1: Organization enrich (the cheapest, most-used call)
  if (domain || company) {
    const orgUrl = new URL("https://api.apollo.io/api/v1/organizations/enrich");
    if (domain) orgUrl.searchParams.set("domain", domain);
    if (company) orgUrl.searchParams.set("organization_name", company);
    tests.push(
      callApollo("org_enrich", orgUrl.toString(), {
        method: "GET",
        headers: { "X-Api-Key": APOLLO_API_KEY, "Cache-Control": "no-cache" },
      })
    );
  }

  // Test 2: People match (free-tier accessible person enrichment)
  if (email || (first_name && last_name && (domain || company))) {
    const matchBody: Record<string, unknown> = {};
    if (email) matchBody.email = email;
    if (first_name) matchBody.first_name = first_name;
    if (last_name) matchBody.last_name = last_name;
    if (domain) matchBody.domain = domain;
    if (company) matchBody.organization_name = company;
    matchBody.reveal_personal_emails = true;
    matchBody.reveal_phone_number = false; // phone reveal usually requires paid plan

    tests.push(
      callApollo("people_match", "https://api.apollo.io/api/v1/people/match", {
        method: "POST",
        headers: {
          "X-Api-Key": APOLLO_API_KEY,
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
        },
        body: JSON.stringify(matchBody),
      })
    );
  }

  // Test 3: Decision-maker search (mixed_people/search) — owners/managers/directors
  if (domain || company) {
    const searchBody: Record<string, unknown> = {
      person_titles: ["owner", "president", "ceo", "general manager", "operations manager", "hr manager"],
      page: 1,
      per_page: 5,
    };
    if (company) searchBody.organization_name = company;
    if (domain) searchBody.q_organization_domains = [domain];

    tests.push(
      callApollo("decision_maker_search", "https://api.apollo.io/api/v1/mixed_people/search", {
        method: "POST",
        headers: {
          "X-Api-Key": APOLLO_API_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(searchBody),
      })
    );
  }

  const results = await Promise.all(tests);

  // Quick quality summary
  const summary = {
    apollo_key_present: true,
    input,
    tests_run: results.length,
    successes: (results as Array<{ ok: boolean }>).filter((r) => r.ok).length,
    quality_signals: extractQualitySignals(results),
  };

  return new Response(
    JSON.stringify({ ok: true, summary, results }, null, 2),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } }
  );
});

function extractQualitySignals(results: unknown[]): Record<string, unknown> {
  const signals: Record<string, unknown> = {};
  for (const r of results as Array<{ label: string; response?: unknown; ok: boolean }>) {
    if (!r.ok) {
      signals[r.label] = "❌ failed";
      continue;
    }
    const resp = r.response as Record<string, unknown> | undefined;
    if (r.label === "org_enrich") {
      const org = (resp?.organization as Record<string, unknown>) || {};
      signals.org_enrich = {
        found: !!org.id,
        employee_count: org.estimated_num_employees ?? null,
        industry: org.industry ?? null,
        revenue: org.organization_revenue_printed ?? null,
        website: org.website_url ?? null,
        phone: org.phone ?? null,
      };
    } else if (r.label === "people_match") {
      const p = (resp?.person as Record<string, unknown>) || {};
      signals.people_match = {
        found: !!p.id,
        name: p.name ?? null,
        title: p.title ?? null,
        email: p.email ?? null,
        email_status: p.email_status ?? null,
        linkedin: p.linkedin_url ?? null,
        personal_emails: p.personal_emails ?? null,
      };
    } else if (r.label === "decision_maker_search") {
      const people = (resp?.people as Array<Record<string, unknown>>) || [];
      signals.decision_maker_search = {
        count: people.length,
        contacts: people.slice(0, 5).map((p) => ({
          name: p.name,
          title: p.title,
          email: p.email,
          email_status: p.email_status,
        })),
      };
    }
  }
  return signals;
}

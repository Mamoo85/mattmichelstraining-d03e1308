// Tests live connectivity to SEC EDGAR, USPTO PatentsView, and GitHub APIs.
// Returns per-provider status with latency + error details. Admin-only.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type ProviderResult = {
  provider: string;
  ok: boolean;
  status: number | null;
  latency_ms: number;
  secret_present: boolean;
  error: string | null;
  detail: string | null;
};

async function timed<T>(fn: () => Promise<T>): Promise<{ value: T | null; ms: number; err: Error | null }> {
  const start = Date.now();
  try {
    const value = await fn();
    return { value, ms: Date.now() - start, err: null };
  } catch (e) {
    return { value: null, ms: Date.now() - start, err: e instanceof Error ? e : new Error(String(e)) };
  }
}

async function testSecEdgar(): Promise<ProviderResult> {
  const ua = Deno.env.get("SEC_EDGAR_USER_AGENT");
  if (!ua) {
    return { provider: "SEC EDGAR", ok: false, status: null, latency_ms: 0, secret_present: false, error: "SEC_EDGAR_USER_AGENT not set", detail: "SEC requires a User-Agent like 'Name email@example.com'" };
  }
  // Basic format validation: SEC requires "Name email@domain"
  const looksValid = /\S+@\S+\.\S+/.test(ua);
  const r = await timed(async () => {
    const res = await fetch("https://data.sec.gov/submissions/CIK0000320193.json", {
      headers: { "User-Agent": ua, "Accept": "application/json" },
    });
    const text = await res.text();
    return { res, text };
  });
  if (r.err || !r.value) {
    return { provider: "SEC EDGAR", ok: false, status: null, latency_ms: r.ms, secret_present: true, error: r.err?.message ?? "Network error", detail: null };
  }
  const { res, text } = r.value;
  const ok = res.ok && text.includes("Apple");
  return {
    provider: "SEC EDGAR",
    ok,
    status: res.status,
    latency_ms: r.ms,
    secret_present: true,
    error: ok ? null : `HTTP ${res.status}`,
    detail: !looksValid ? "User-Agent should be format: 'Your Name your@email.com'" : ok ? "Fetched Apple 10-K submissions index" : text.slice(0, 200),
  };
}

async function testUspto(): Promise<ProviderResult> {
  const key = Deno.env.get("USPTO_API_KEY");
  if (!key) {
    return { provider: "USPTO", ok: false, status: null, latency_ms: 0, secret_present: false, error: "USPTO_API_KEY not set", detail: null };
  }
  // PatentsView API (USPTO Open Data Portal). Uses X-Api-Key header.
  const r = await timed(async () => {
    const res = await fetch("https://search.patentsview.org/api/v1/patent/?q=%7B%22patent_number%22%3A%2210000000%22%7D&f=%5B%22patent_number%22%2C%22patent_title%22%5D", {
      headers: { "X-Api-Key": key, "Accept": "application/json" },
    });
    const text = await res.text();
    return { res, text };
  });
  if (r.err || !r.value) {
    return { provider: "USPTO", ok: false, status: null, latency_ms: r.ms, secret_present: true, error: r.err?.message ?? "Network error", detail: null };
  }
  const { res, text } = r.value;
  const ok = res.ok;
  return {
    provider: "USPTO",
    ok,
    status: res.status,
    latency_ms: r.ms,
    secret_present: true,
    error: ok ? null : `HTTP ${res.status}`,
    detail: ok ? "PatentsView query returned successfully" : text.slice(0, 200),
  };
}

async function testGithub(): Promise<ProviderResult> {
  const token = Deno.env.get("GITHUB_TOKEN");
  if (!token) {
    return { provider: "GitHub", ok: false, status: null, latency_ms: 0, secret_present: false, error: "GITHUB_TOKEN not set", detail: null };
  }
  const r = await timed(async () => {
    const res = await fetch("https://api.github.com/user", {
      headers: {
        "Authorization": `Bearer ${token}`,
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "lovable-dwa-validator",
      },
    });
    const text = await res.text();
    return { res, text };
  });
  if (r.err || !r.value) {
    return { provider: "GitHub", ok: false, status: null, latency_ms: r.ms, secret_present: true, error: r.err?.message ?? "Network error", detail: null };
  }
  const { res, text } = r.value;
  if (!res.ok) {
    return {
      provider: "GitHub",
      ok: false,
      status: res.status,
      latency_ms: r.ms,
      secret_present: true,
      error: `HTTP ${res.status}`,
      detail: res.status === 401 ? "Token is invalid or expired" : text.slice(0, 200),
    };
  }
  let login = "unknown";
  let scopes = res.headers.get("x-oauth-scopes") ?? "(fine-grained PAT)";
  try { login = JSON.parse(text).login ?? "unknown"; } catch { /* noop */ }
  return {
    provider: "GitHub",
    ok: true,
    status: res.status,
    latency_ms: r.ms,
    secret_present: true,
    error: null,
    detail: `Authenticated as ${login} • scopes: ${scopes}`,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Admin-only: require valid JWT and admin role
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) {
    return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const { data: userData, error: userErr } = await supabase.auth.getUser();
  if (userErr || !userData?.user) {
    return new Response(JSON.stringify({ error: "Invalid session" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const { data: isAdmin, error: roleErr } = await supabase.rpc("has_role", {
    _user_id: userData.user.id,
    _role: "admin",
  });
  if (roleErr || !isAdmin) {
    return new Response(JSON.stringify({ error: "Admin role required" }), {
      status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const [sec, uspto, github] = await Promise.all([testSecEdgar(), testUspto(), testGithub()]);
  const results = [sec, uspto, github];
  const allOk = results.every((r) => r.ok);

  return new Response(JSON.stringify({
    ok: allOk,
    timestamp: new Date().toISOString(),
    results,
  }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

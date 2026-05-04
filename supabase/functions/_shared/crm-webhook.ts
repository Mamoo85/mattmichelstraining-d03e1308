// Shared outbound CRM webhook helper
// Lets customers receive new leads/candidates in their own CRM
// (Salesforce, Jobber, Greenhouse, Lever, Zapier, Make, n8n, etc.)
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const SB = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

async function hmacHex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function deliverCrmWebhook(opts: {
  product: string;
  client_id?: string | null;
  url?: string | null;
  secret?: string | null;
  payload: Record<string, unknown>;
}): Promise<void> {
  const { product, client_id, url, secret, payload } = opts;
  if (!url) return;
  const body = JSON.stringify({ product, client_id, ...payload, _ts: Date.now() });
  const headers: Record<string, string> = { "Content-Type": "application/json", "User-Agent": "DWA-Webhook/1.0" };
  if (secret) headers["X-DWA-Signature"] = "sha256=" + await hmacHex(secret, body);

  let status = 0, ok = false, error: string | null = null;
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10_000);
    const res = await fetch(url, { method: "POST", headers, body, signal: ctrl.signal });
    clearTimeout(t);
    status = res.status;
    ok = res.ok;
    if (!ok) error = (await res.text().catch(() => "")).slice(0, 500);
  } catch (e) {
    error = e instanceof Error ? e.message : String(e);
  }

  try {
    await SB.from("crm_webhook_deliveries").insert({
      product, client_id: client_id ?? null,
      payload_summary: body.slice(0, 500),
      status_code: status || null, ok, error,
    });
  } catch { /* never let logging break delivery flow */ }
}

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SITE_URL = "https://www.mattmichelstraining.com";
const GSC_API = "https://www.googleapis.com/webmasters/v3";

async function getAccessToken(): Promise<string> {
  const keyRaw = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_KEY");
  if (!keyRaw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY not set");

  // Support both raw JSON and base64-encoded JSON
  let keyJson: string;
  if (keyRaw.trimStart().startsWith("{")) {
    keyJson = keyRaw;
  } else {
    keyJson = new TextDecoder().decode(
      Uint8Array.from(atob(keyRaw), (c) => c.charCodeAt(0))
    );
  }

  const key = JSON.parse(keyJson);
  const now = Math.floor(Date.now() / 1000);

  // Build JWT header + payload
  const header = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" }))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const payload = btoa(JSON.stringify({
    iss: key.client_email,
    scope: "https://www.googleapis.com/auth/webmasters.readonly",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  // Import private key and sign
  const pemBody = key.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s/g, "");

  const binaryKey = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8", binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );

  const signatureInput = new TextEncoder().encode(`${header}.${payload}`);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, signatureInput);
  const sig = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const jwt = `${header}.${payload}.${sig}`;

  // Exchange for access token
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  if (!tokenRes.ok) {
    const err = await tokenRes.text();
    throw new Error(`Token exchange failed: ${err}`);
  }

  const tokenData = await tokenRes.json();
  return tokenData.access_token;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    console.log("[GSC] Starting fetch-search-console");
    // Auth check
    const authHeader = req.headers.get("authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const sb = createClient(supabaseUrl, supabaseKey);

    if (authHeader) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user }, error } = await sb.auth.getUser(token);
      if (error || !user) {
        console.error("[GSC] Auth failed:", error?.message);
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      // Check admin
      const { data: roles } = await sb.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
      if (!roles?.length) {
        console.error("[GSC] Not admin, user_id:", user.id);
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      console.log("[GSC] Auth OK, admin verified");
    }

    const body = req.method === "POST" ? await req.json() : {};
    const daysBack = body.days || 28;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - daysBack);

    console.log("[GSC] Getting access token...");
    const accessToken = await getAccessToken();
    console.log("[GSC] Access token obtained, querying GSC API...");
    const encodedSite = encodeURIComponent(SITE_URL);

    // Fetch page-level data
    const pageRes = await fetch(
      `${GSC_API}/sites/${encodedSite}/searchAnalytics/query`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          startDate: startDate.toISOString().split("T")[0],
          endDate: endDate.toISOString().split("T")[0],
          dimensions: ["page", "query", "date"],
          rowLimit: 5000,
          type: "web",
        }),
      }
    );

    if (!pageRes.ok) {
      const errText = await pageRes.text();
      throw new Error(`GSC API error [${pageRes.status}]: ${errText}`);
    }

    const pageData = await pageRes.json();
    const rows = pageData.rows || [];

    // Upsert into database
    if (rows.length > 0) {
      const records = rows.map((r: any) => ({
        page_url: r.keys[0],
        query: r.keys[1] || null,
        date: r.keys[2],
        clicks: r.clicks || 0,
        impressions: r.impressions || 0,
        ctr: r.ctr || 0,
        position: r.position || 0,
      }));

      // Batch upsert in chunks of 500
      for (let i = 0; i < records.length; i += 500) {
        const chunk = records.slice(i, i + 500);
        const { error: upsertErr } = await sb
          .from("search_console_data")
          .upsert(chunk, { onConflict: "page_url,query,date" });
        if (upsertErr) console.error("Upsert error:", upsertErr);
      }
    }

    return new Response(JSON.stringify({ ok: true, rows_synced: rows.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("GSC fetch error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

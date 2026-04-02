// Generates OAuth authorization URLs for client Facebook/LinkedIn connections
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const LINKEDIN_CLIENT_ID = Deno.env.get("LINKEDIN_CLIENT_ID") || "";
const META_APP_ID = Deno.env.get("META_APP_ID") || "";
const CALLBACK_URL = `${SUPABASE_URL}/functions/v1/social-oauth-callback`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { platform, client_id } = await req.json();

    if (!client_id || !platform) {
      return new Response(JSON.stringify({ error: "Missing client_id or platform" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const state = btoa(JSON.stringify({ client_id, platform }));

    let authUrl = "";

    if (platform === "linkedin") {
      if (!LINKEDIN_CLIENT_ID) {
        return new Response(JSON.stringify({ error: "LinkedIn not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const params = new URLSearchParams({
        response_type: "code",
        client_id: LINKEDIN_CLIENT_ID,
        redirect_uri: CALLBACK_URL,
        state,
        scope: "openid profile w_member_social",
      });
      authUrl = `https://www.linkedin.com/oauth/v2/authorization?${params}`;
    } else if (platform === "facebook") {
      if (!META_APP_ID) {
        return new Response(JSON.stringify({ error: "Facebook not configured" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const params = new URLSearchParams({
        client_id: META_APP_ID,
        redirect_uri: CALLBACK_URL,
        state,
        scope: "pages_manage_posts,pages_read_engagement",
        response_type: "code",
      });
      authUrl = `https://www.facebook.com/v19.0/dialog/oauth?${params}`;
    } else {
      return new Response(JSON.stringify({ error: "Unknown platform" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ url: authUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

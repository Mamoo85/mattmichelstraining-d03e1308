import { createClient } from "npm:@supabase/supabase-js@2";
import { stealthScrape, reasonToCopy } from "../_shared/stealth-scrape.ts";

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ success: false, error: 'Not authenticated' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const token = authHeader.replace('Bearer ', '');
    const supabase = createClient(
      SUPABASE_URL,
      SUPABASE_ANON_KEY,
      { global: { headers: { Authorization: authHeader } } }
    );
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims?.sub) {
      return new Response(JSON.stringify({ success: false, error: 'Auth failed' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const userId = claims.claims.sub as string;

    // Per-user rate limit: 10 scrapes/hour to prevent paid-API abuse.
    try {
      const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
      const svc = createClient(SUPABASE_URL, SERVICE_KEY);
      const sinceIso = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const key = `firecrawl-scrape:${userId}`;
      const { count } = await svc.from('free_generation_log').select('id', { count: 'exact', head: true })
        .eq('ip_address', key).gte('created_at', sinceIso);
      if ((count ?? 0) >= 10) {
        return new Response(JSON.stringify({ success: false, error: 'Rate limit exceeded (10/hour). Try again later.' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      await svc.from('free_generation_log').insert({ ip_address: key });
    } catch (e) { console.warn('rate-limit check failed:', e); }


    const { url, options } = await req.json();
    if (!url) {
      return new Response(
        JSON.stringify({ success: false, error: 'URL is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const result = await stealthScrape(url, {
      formats: options?.formats,
      onlyMainContent: options?.onlyMainContent,
      maxChars: options?.maxChars,
    });

    if (!result.ok) {
      // Always 200 — the request succeeded, the page just wouldn't cooperate.
      return new Response(
        JSON.stringify({ success: false, message: reasonToCopy(result.reason) }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Match v2 shape clients expect: { success, data: { markdown, html, links, metadata } }
    return new Response(
      JSON.stringify({
        success: true,
        data: {
          markdown: result.markdown,
          html: result.html,
          links: result.links,
          metadata: result.metadata,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (_error) {
    return new Response(
      JSON.stringify({ success: false, message: reasonToCopy() }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    // Auth: require user JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the user via Supabase auth
    const userSb = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") || "");
    const { data: { user }, error: authError } = await userSb.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { contacts } = await req.json() as { contacts: { email: string; name?: string }[] };

    if (!Array.isArray(contacts) || contacts.length === 0) {
      return new Response(JSON.stringify({ error: "contacts array is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Look up this user's client record
    const { data: client, error: clientError } = await (sb.from as any)("re_newsletter_clients")
      .select("id")
      .eq("user_id", user.id)
      .eq("subscription_status", "active")
      .limit(1)
      .single();

    if (clientError || !client) {
      return new Response(JSON.stringify({ error: "No active subscription found for this user" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate and clean contacts
    const validContacts = contacts
      .filter((c) => c.email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c.email.trim()))
      .map((c) => ({
        client_id: client.id,
        contact_email: c.email.trim().toLowerCase(),
        contact_name: c.name?.trim() || null,
      }));

    if (validContacts.length === 0) {
      return new Response(JSON.stringify({ added: 0, message: "No valid email addresses found" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Bulk insert, ignore duplicates (ON CONFLICT DO NOTHING via upsert ignoreDuplicates)
    const { data: inserted, error: insertError } = await (sb.from as any)("re_newsletter_contacts")
      .upsert(validContacts, { onConflict: "client_id,contact_email", ignoreDuplicates: true })
      .select();

    if (insertError) throw insertError;

    const addedCount = inserted?.length || 0;

    // Update contacts_count on the client record
    const { data: countResult } = await (sb.from as any)("re_newsletter_contacts")
      .select("id", { count: "exact", head: true })
      .eq("client_id", client.id);

    await (sb.from as any)("re_newsletter_clients")
      .update({ contacts_count: (countResult as any)?.count || addedCount })
      .eq("id", client.id);

    console.log(`[RE-NEWSLETTER-ADD-CONTACTS] Added ${addedCount} contacts for client ${client.id}`);

    return new Response(JSON.stringify({ added: addedCount, total_submitted: contacts.length, valid: validContacts.length }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[RE-NEWSLETTER-ADD-CONTACTS] Error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

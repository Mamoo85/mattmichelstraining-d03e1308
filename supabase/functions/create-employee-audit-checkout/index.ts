import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SITE = "https://www.mattmichelstraining.com";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  try {
    const { company_name, employee_emails, customer_email } = await req.json();

    if (!customer_email || !company_name || !employee_emails || !Array.isArray(employee_emails) || employee_emails.length === 0) {
      return new Response(JSON.stringify({ error: "customer_email, company_name, and employee_emails are required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (employee_emails.length > 100) {
      return new Response(JSON.stringify({ error: "Maximum 100 employee emails per audit" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

    // Insert audit record and get UUID back
    const { data: auditRow, error: insertError } = await sb
      .from("employee_credential_audits")
      .insert({
        customer_email,
        company_name,
        employee_emails,
        status: "pending",
      })
      .select("id")
      .single();

    if (insertError || !auditRow) {
      console.error("[CREATE-EMPLOYEE-AUDIT-CHECKOUT] DB insert error:", insertError);
      return new Response(JSON.stringify({ error: "Failed to create audit record" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const auditId = auditRow.id;

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email,
      line_items: [{
        price_data: {
          currency: "usd",
          unit_amount: 14900,
          product_data: { name: "Employee Credential Audit" },
        },
        quantity: 1,
      }],
      metadata: {
        type: "employee_credential_audit",
        audit_id: auditId,
        email: customer_email,
        company_name,
        is_test: "false",
      },
      success_url: `${SITE}/employee-credential-audit?success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}/employee-credential-audit`,
    });

    console.log(`[CREATE-EMPLOYEE-AUDIT-CHECKOUT] Session created for ${customer_email}, audit_id=${auditId}`);

    return new Response(JSON.stringify({ url: session.url }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("[CREATE-EMPLOYEE-AUDIT-CHECKOUT] Error:", e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// send-teaser-email — sends a personalized teaser email for one of the
// 5 DWA products (SiteRadar, Missed-Call, Demand Radar, Buyer Radar,
// Industry Pulse) with a 7-day free trial CTA. Supports preview mode
// (returns rendered HTML without sending) for the admin review page.
//
// POST body:
//   {
//     slug: "siteradar" | "missed-call" | "demand-radar" | "buyer-radar" | "industry-pulse",
//     to: "ceo@company.com",
//     vars: { company, ceo_first_name, recent_signal, city },
//     preview?: true     // if true, returns { subject, html } instead of sending
//   }

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { dwaColdEmail, dwaWrap, trialCtaHtml, plainCtaHtml, isTrialEligible } from "../_shared/dwa-email.ts";
import { renderTeaser, TEASER_PRODUCTS } from "../_shared/teaser-emails.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }

  const { slug, to, vars, preview } = body || {};
  if (!slug || !TEASER_PRODUCTS.includes(slug)) {
    return json({ error: "invalid_slug", valid: TEASER_PRODUCTS }, 400);
  }
  const rendered = renderTeaser(slug, vars || {});
  if (!rendered) return json({ error: "render_failed" }, 500);

  // Preview mode — return wrapped HTML without sending
  if (preview) {
    const cta = isTrialEligible(rendered.product)
      ? trialCtaHtml({ product: rendered.product, url: rendered.ctaUrl })
      : plainCtaHtml({ url: rendered.ctaUrl, text: "See it live" });
    const html = dwaWrap(`${rendered.bodyHtml}\n${cta}`);
    return json({
      ok: true,
      preview: true,
      subject: rendered.subject,
      html,
      ctaUrl: rendered.ctaUrl,
      product: rendered.product,
    });
  }

  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return json({ error: "invalid_to" }, 400);
  }

  const sb = createClient(SUPABASE_URL, SERVICE_KEY);
  const result = await dwaColdEmail(
    {
      to,
      subject: rendered.subject,
      bodyHtml: rendered.bodyHtml,
      product: rendered.product,
      ctaUrl: rendered.ctaUrl,
      templateName: rendered.templateName,
    },
    sb,
  );

  return json({ ok: result.ok, error: result.error, messageId: result.messageId }, result.ok ? 200 : 500);
});

function json(b: unknown, status = 200) {
  return new Response(JSON.stringify(b), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

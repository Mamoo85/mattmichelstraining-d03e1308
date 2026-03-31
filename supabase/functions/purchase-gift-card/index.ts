import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TIER_DISCOUNTS: Record<string, number> = {
  basic: 10, pro: 15, elite: 20, team: 25,
};

const GIFT_CARD_PRICES: Record<number, string> = {
  25: "price_1TBrN7D52tPWee46oXruhpLi",
  50: "price_1TBrNhD52tPWee46AzyyW9gX",
  100: "price_1TBrO2D52tPWee464iT4y2rg",
  150: "price_1TBrOSD52tPWee468kpeMd4M",
};

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "M2-";
  for (let i = 0; i < 8; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const logStep = (step: string, details?: any) => {
  console.log(`[GIFT-CARD] ${step}${details ? ` - ${JSON.stringify(details)}` : ''}`);
};


const EMAIL_SIGNATURE = `<div style="margin-top:24px;padding-top:16px;border-top:1px solid #334155;display:flex;align-items:center;gap:12px;"><img src="https://www.mattmichelstraining.com/images/matt-boat.jpg" alt="Matt Michels" style="width:48px;height:48px;border-radius:50%;object-fit:cover;" /><div style="font-size:13px;color:#94a3b8;"><strong style="color:#e2e8f0;">Matt Michels</strong><br/>Grosse Pointe, MI · (313) 806-4952</div><img src="https://www.mattmichelstraining.com/images/m2-development-logo.png" alt="M2 Development" style="width:36px;height:36px;margin-left:auto;object-fit:contain;" /></div>`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) throw new Error("Not authenticated");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !userData.user?.email) throw new Error("Auth failed");

    const user = userData.user;
    logStep("User authenticated", { email: user.email });

    const { amount, recipientEmail } = await req.json();
    if (!amount || !GIFT_CARD_PRICES[amount]) throw new Error("Invalid gift card amount");

    const priceId = GIFT_CARD_PRICES[amount];

    // Check user's subscription tier for discount
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("subscription_tier")
      .eq("user_id", user.id)
      .single();

    const tier = profile?.subscription_tier || "free";
    const discountPct = TIER_DISCOUNTS[tier] || 0;

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", { apiVersion: "2025-08-27.basil" });

    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    const customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

    const origin = req.headers.get("origin") || "https://www.mattmichelstraining.com";
    const giftCode = generateCode();

    const sessionParams: any = {
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "payment",
      success_url: `${origin}/shop?gift_card=success&code=${giftCode}`,
      cancel_url: `${origin}/shop`,
      metadata: {
        type: "gift_card",
        gift_code: giftCode,
        gift_amount: String(amount),
        recipient_email: recipientEmail || "",
        purchaser_id: user.id,
      },
    };

    // Apply tier discount
    if (discountPct > 0) {
      const coupon = await stripe.coupons.create({
        percent_off: discountPct,
        duration: "once",
        name: `Member ${discountPct}% discount`,
      });
      sessionParams.discounts = [{ coupon: coupon.id }];
      logStep("Tier discount applied", { tier, discountPct });
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    logStep("Checkout session created", { sessionId: session.id });

    // Pre-create the gift card as inactive — activated after payment via webhook/verify
    await supabaseClient.from("gift_cards").insert({
      code: giftCode,
      original_amount: amount,
      remaining_balance: amount,
      purchaser_id: user.id,
      recipient_email: recipientEmail || null,
      stripe_session_id: session.id,
      is_active: false,
    });

    logStep("Gift card pre-created", { code: giftCode, amount });

    // Send email notifications
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (resendApiKey) {
      const storeUrl = `${origin}/shop`;
      const emailHtml = `
        <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto;padding:32px 24px;background:#ffffff;">
          <div style="text-align:center;margin-bottom:24px;">
            <h1 style="font-size:24px;font-weight:900;letter-spacing:-0.5px;color:#1a1a1a;margin:0;">M² TRAINING</h1>
            <p style="font-size:11px;letter-spacing:3px;color:#888;margin:4px 0 0;text-transform:uppercase;">Gift Card</p>
          </div>
          <div style="background:#f5f5f5;border:2px solid #e5e5e5;padding:24px;text-align:center;margin-bottom:24px;">
            <p style="font-size:13px;color:#666;margin:0 0 8px;">Your gift card code</p>
            <div style="font-size:28px;font-weight:900;font-family:monospace;letter-spacing:4px;color:#1a1a1a;padding:12px;background:#fff;border:2px dashed #ccc;display:inline-block;">${giftCode}</div>
            <p style="font-size:32px;font-weight:900;color:#1a1a1a;margin:16px 0 4px;">$${amount}.00</p>
            <p style="font-size:12px;color:#888;margin:0;">Use toward any program, custom workout, or product</p>
          </div>
          <div style="text-align:center;margin-bottom:24px;">
            <a href="${storeUrl}" style="display:inline-block;background:#1a1a1a;color:#ffffff;padding:14px 32px;text-decoration:none;font-size:12px;font-weight:700;letter-spacing:2px;text-transform:uppercase;">Shop Now →</a>
          </div>
          <div style="background:#fafafa;padding:16px;border:1px solid #eee;">
            <p style="font-size:11px;color:#888;margin:0;line-height:1.6;">
              <strong style="color:#555;">How to use:</strong> Enter your code at checkout when purchasing any product in the M² Training store. Your balance will be applied automatically.
            </p>
          </div>
          <p style="font-size:10px;color:#bbb;text-align:center;margin-top:24px;">M² Training · Matt Michels Performance</p>
        </div>
      `;

      const emailsToSend: { to: string; subject: string }[] = [];

      // Send to recipient if provided
      if (recipientEmail) {
        emailsToSend.push({
          to: recipientEmail,
          subject: `You've received a $${amount} M² Training Gift Card! 🎁`,
        });
      }

      // Always send a copy to the purchaser
      emailsToSend.push({
        to: user.email!,
        subject: recipientEmail
          ? `Gift card sent to ${recipientEmail} — $${amount} M² Gift Card`
          : `Your $${amount} M² Training Gift Card`,
      });

      for (const email of emailsToSend) {
        try {
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${resendApiKey}`,
            },
            body: JSON.stringify({
              from: "M² Training <noreply@mattmichelstraining.com>",
              to: [email.to], bcc: ["matthewmichels4@gmail.com"],
              subject: email.subject,
              html: emailHtml,
            }),
          });
          logStep("Email sent", { to: email.to });
        } catch (emailErr) {
          logStep("Email send failed (non-blocking)", { to: email.to, error: String(emailErr) });
        }
      }
    }

    return new Response(JSON.stringify({ url: session.url, code: giftCode }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

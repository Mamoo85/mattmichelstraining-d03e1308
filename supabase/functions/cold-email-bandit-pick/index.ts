// cold-email-bandit-pick — Thompson-sampling arm picker.
// Returns the best (subject, opener, cta) arm combo for a vertical based on
// historical sent/reply counts in `email_arm_stats`. Arms with no history use
// optimistic priors (alpha=1, beta=1) so they always get explored.

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  SUBJECT_ARMS, OPENER_ARMS, CTA_ARMS, betaSample, corsHeaders, armKey,
  type SubjectArm, type OpenerArm, type CtaArm,
} from "../_shared/coldEmailShared.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const { vertical = "default", n = 1 } = await req.json().catch(() => ({}));
    const sb = createClient(SUPABASE_URL, SERVICE_ROLE, { auth: { persistSession: false } });

    const { data: stats, error } = await sb
      .from("email_arm_stats")
      .select("subject_arm, opener_arm, cta_arm, sent_count, reply_count, conversion_count")
      .eq("vertical", vertical);
    if (error) throw new Error(`load stats: ${error.message}`);

    const lookup = new Map<string, { sent: number; replies: number; conv: number }>();
    for (const r of stats || []) {
      lookup.set(armKey({
        subject: r.subject_arm as SubjectArm,
        opener: r.opener_arm as OpenerArm,
        cta: r.cta_arm as CtaArm,
      }), {
        sent: r.sent_count ?? 0,
        replies: r.reply_count ?? 0,
        conv: r.conversion_count ?? 0,
      });
    }

    type Pick = { subject: SubjectArm; opener: OpenerArm; cta: CtaArm; sample: number; sent: number; replies: number };
    const picks: Pick[] = [];
    // Score every combination via Thompson sampling, keep top N
    const samples: Pick[] = [];
    for (const s of SUBJECT_ARMS) {
      for (const o of OPENER_ARMS) {
        for (const c of CTA_ARMS) {
          const k = armKey({ subject: s, opener: o, cta: c });
          const stat = lookup.get(k) || { sent: 0, replies: 0, conv: 0 };
          // alpha = replies + conversions*2 + 1, beta = (sent - replies) + 1
          const alpha = stat.replies + stat.conv * 2 + 1;
          const beta = Math.max(0, stat.sent - stat.replies) + 1;
          const sample = betaSample(alpha, beta);
          samples.push({ subject: s, opener: o, cta: c, sample, sent: stat.sent, replies: stat.replies });
        }
      }
    }
    samples.sort((a, b) => b.sample - a.sample);
    for (let i = 0; i < Math.max(1, Math.min(n, 10)); i++) picks.push(samples[i]);

    return new Response(JSON.stringify({
      vertical,
      picks,
      total_arms: samples.length,
      explored_arms: lookup.size,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("[cold-email-bandit-pick]", e);
    return new Response(JSON.stringify({ error: String(e instanceof Error ? e.message : e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// talent-ingest — single ingestion choke point for Talent Radar scanners.
// POST { source, run_id?, replay_url?, candidates: RawCandidate[] }
// Auth: Bearer SUPABASE_SERVICE_ROLE_KEY (server-to-server only).

import { createClient } from "npm:@supabase/supabase-js@2";
import { sendSMS, ADMIN_PHONE } from "../_shared/twilio.ts";
import { normalize } from "../_shared/talent-ingest/normalize.ts";
import { buildFingerprint } from "../_shared/talent-ingest/fingerprint.ts";
import { computeScore } from "../_shared/talent-ingest/score.ts";
import { appendProvenance } from "../_shared/talent-ingest/provenance.ts";
import type { IngestRequest, IngestResult, ProvenanceEntry, RawCandidate } from "../_shared/talent-ingest/types.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TWILIO_FROM = Deno.env.get("TWILIO_PHONE_NUMBER") || "";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  // Service-role auth
  const auth = req.headers.get("Authorization") || "";
  if (auth !== `Bearer ${SUPABASE_SERVICE_KEY}`) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  let body: IngestRequest;
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ ok: false, error: "bad json" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const { source, candidates = [], replay_url } = body;
  if (!source || !Array.isArray(candidates)) {
    return new Response(JSON.stringify({ ok: false, error: "source + candidates[] required" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Open a hire_alert_runs row (or reuse provided run_id)
  let run_id = body.run_id;
  if (!run_id) {
    const { data: run } = await sb.from("hire_alert_runs").insert({
      source, source_label: source, replay_url: replay_url ?? null, status: "running",
      candidates_found: candidates.length,
    }).select("id").single();
    run_id = run?.id;
  }

  let inserted = 0, merged = 0, rejected = 0, errors = 0, hot_alerts = 0;
  const errorsDetail: Array<{ name?: string; reason: string }> = [];

  for (const raw of candidates as RawCandidate[]) {
    try {
      const n = normalize(raw);
      const observed_at = raw.observed_at || new Date().toISOString();
      const provEntry: ProvenanceEntry = {
        source: raw.source, source_url: raw.source_url,
        source_record_id: raw.source_record_id, observed_at,
      };

      // Junk gate
      if (n.is_junk) {
        await sb.from("talent_ingest_raw").insert({
          source, source_record_id: raw.source_record_id, run_id,
          payload: raw as unknown as Record<string, unknown>,
          dedupe_outcome: "rejected", rejection_reason: "junk_name",
        });
        rejected++;
        continue;
      }

      const fingerprint = await buildFingerprint(n, raw);
      if (!fingerprint) {
        await sb.from("talent_ingest_raw").insert({
          source, source_record_id: raw.source_record_id, run_id,
          payload: raw as unknown as Record<string, unknown>,
          dedupe_outcome: "rejected", rejection_reason: "no_fingerprint_keys",
        });
        rejected++;
        continue;
      }

      const score = computeScore(raw, n);

      const { data: existing } = await sb.from("hire_alert_candidates")
        .select("id, sources, provenance, score, phone, email, full_name, trade, license_number, license_type, city, state, zip, current_employer, current_title, last_seen_at, enrichment_status, ingest_confidence")
        .eq("fingerprint", fingerprint).maybeSingle();

      if (!existing) {
        const ninety = Date.now() - 90 * 86400000;
        const _stale = false; // new row, ignore
        void _stale; void ninety;
        const { data: ins, error: insErr } = await sb.from("hire_alert_candidates").insert({
          name: raw.full_name,
          full_name: raw.full_name,
          name_normalized: n.name_normalized,
          trade: n.trade_canonical || raw.trade || null,
          city: raw.city || null,
          state: n.state_upper || raw.state || null,
          zip: raw.zip || null,
          license_type: raw.license_type || null,
          license_number: raw.license_number || null,
          license_expiry: raw.license_expiry || null,
          phone: raw.phone || null,
          phone_e164: n.phone_e164,
          email: raw.email || null,
          email_normalized: n.email_normalized,
          domain_normalized: n.domain_normalized,
          current_employer: raw.current_employer || null,
          current_title: raw.current_title || null,
          is_company_name: !!raw.is_company_name,
          source: raw.source,
          last_source: raw.source,
          sources: [raw.source],
          provenance: [provEntry],
          score,
          status: "new",
          fingerprint,
          ingest_confidence: n.confidence,
          needs_review: n.confidence < 0.6,
          raw_data: raw.raw_data || {},
          first_seen_at: observed_at,
          last_seen_at: observed_at,
        }).select("id").single();

        if (insErr) {
          errors++;
          errorsDetail.push({ name: raw.full_name, reason: insErr.message });
          await sb.from("talent_ingest_raw").insert({
            source, source_record_id: raw.source_record_id, run_id,
            payload: raw as unknown as Record<string, unknown>, fingerprint,
            dedupe_outcome: "error", rejection_reason: insErr.message,
          });
          continue;
        }
        inserted++;
        await sb.from("talent_ingest_raw").insert({
          source, source_record_id: raw.source_record_id, run_id,
          payload: raw as unknown as Record<string, unknown>, fingerprint,
          dedupe_outcome: "new", candidate_id: ins?.id,
        });

        // Hot-candidate SMS
        if (score >= 8 && n.phone_e164 && TWILIO_FROM) {
          try {
            await sendSMS(
              ADMIN_PHONE, TWILIO_FROM,
              `🔥 Hot TechAlert candidate: ${raw.full_name}, ${n.trade_canonical || raw.trade || "?"}, ${n.state_upper || "?"} — ${n.phone_e164}`,
              "techalert",
            );
            hot_alerts++;
          } catch (_e) { /* swallow SMS errors */ }
        }
      } else {
        // Merge — never overwrite non-null with null; bump score; refresh last_seen_at; append source/provenance
        const newSources = Array.from(new Set([...(existing.sources || []), raw.source]));
        const newProv = appendProvenance(existing.provenance as unknown as ProvenanceEntry[], provEntry);
        const stale = existing.last_seen_at && (Date.now() - new Date(existing.last_seen_at).getTime() > 90 * 86400000);

        const upd: Record<string, unknown> = {
          phone: existing.phone ?? raw.phone ?? null,
          email: existing.email ?? raw.email ?? null,
          full_name: existing.full_name ?? raw.full_name,
          trade: existing.trade ?? n.trade_canonical ?? raw.trade ?? null,
          license_number: existing.license_number ?? raw.license_number ?? null,
          license_type: existing.license_type ?? raw.license_type ?? null,
          city: existing.city ?? raw.city ?? null,
          state: existing.state ?? n.state_upper ?? raw.state ?? null,
          zip: existing.zip ?? raw.zip ?? null,
          current_employer: existing.current_employer ?? raw.current_employer ?? null,
          current_title: existing.current_title ?? raw.current_title ?? null,
          phone_e164: (existing as any).phone_e164 ?? n.phone_e164,
          email_normalized: (existing as any).email_normalized ?? n.email_normalized,
          score: Math.max(existing.score ?? 0, score),
          last_seen_at: observed_at,
          last_source: raw.source,
          sources: newSources,
          provenance: newProv,
          ingest_confidence: Math.max(existing.ingest_confidence ?? 0, n.confidence),
        };
        if (stale) upd.enrichment_status = "pending";

        const { error: updErr } = await sb.from("hire_alert_candidates")
          .update(upd).eq("id", existing.id);
        if (updErr) {
          errors++;
          errorsDetail.push({ name: raw.full_name, reason: updErr.message });
        } else {
          merged++;
        }
        await sb.from("talent_ingest_raw").insert({
          source, source_record_id: raw.source_record_id, run_id,
          payload: raw as unknown as Record<string, unknown>, fingerprint,
          dedupe_outcome: "merged", candidate_id: existing.id,
        });
      }
    } catch (e) {
      errors++;
      const msg = (e as Error).message;
      errorsDetail.push({ name: raw.full_name, reason: msg });
    }
  }

  if (run_id) {
    await sb.from("hire_alert_runs").update({
      candidates_found: candidates.length,
      new_candidates: inserted,
      merged, rejected, skipped: 0,
      candidates_alerted: hot_alerts,
      errors_detail: errorsDetail,
      completed_at: new Date().toISOString(),
      status: errors > 0 ? "completed_with_errors" : "completed",
    }).eq("id", run_id);
  }

  const result: IngestResult = {
    ok: true, run_id: run_id || "", inserted, merged, rejected, errors, hot_alerts,
  };
  return new Response(JSON.stringify(result), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});

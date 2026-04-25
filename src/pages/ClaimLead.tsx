// /claim-lead?lead_id=xxx&contractor_id=xxx&email=xxx
// Contractor lands here from FOMO teaser SMS.
// Shows lead preview (trade, city, project type — NO contact info) + $50 claim button.

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LeadQualityBadges, { LeadQualityData } from "@/components/contractor/LeadQualityBadges";
import LinkExpired from "@/components/shared/LinkExpired";
import { parseParams } from "@/lib/parseSearchParams";
import { toastError, toastInfo } from "@/lib/toast";
import ActionButton from "@/components/ui/action-button";

export default function ClaimLead() {
  const [searchParams] = useSearchParams();
  const parsed = parseParams(searchParams, {
    lead_id: "uuid",
    contractor_id: "uuid",
    email: "email",
  });
  const lead_id = parsed.ok ? parsed.values.lead_id : "";
  const contractor_id = parsed.ok ? parsed.values.contractor_id : "";
  const contractor_email = parsed.ok ? parsed.values.email : "";
  const hasMissingParams = !parsed.ok;

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "locked" | "claimed" | "error">("idle");
  const [minutesLeft, setMinutesLeft] = useState(0);
  const [leadPreview, setLeadPreview] = useState<
    | ({ trade: string; city: string; project_type: string } & LeadQualityData)
    | null
  >(null);
  const [previewLoading, setPreviewLoading] = useState(!hasMissingParams);
  const claimLock = useRef(false);

  useEffect(() => {
    if (!lead_id) return;
    // Fetch non-sensitive lead preview + quality flags (no contact info)
    (supabase
      .from("contractor_leads") as any)
      .select(
        "project_type, status, phone_carrier_type, email_breach_count, email_deliverable, " +
        "identity_verified, estimated_home_value, ownership_years, lead_type, quality_score, " +
        "lead_tier, contractor_lead_sites(trade, city)"
      )
      .eq("id", lead_id)
      .single()
      .then(({ data }: { data: any }) => {
        if (data) {
          const site = data.contractor_lead_sites;
          setLeadPreview({
            trade: site?.trade || "Service",
            city: site?.city || "Metro Detroit",
            project_type: data.project_type || "Service request",
            phone_carrier_type: data.phone_carrier_type ?? null,
            email_breach_count: data.email_breach_count ?? null,
            email_deliverable: data.email_deliverable ?? null,
            identity_verified: data.identity_verified ?? null,
            estimated_home_value: data.estimated_home_value ?? null,
            ownership_years: data.ownership_years ?? null,
            lead_type: data.lead_type ?? null,
            quality_score: data.quality_score ?? null,
            lead_tier: data.lead_tier ?? null,
          });
          if (data.status === "sold") setStatus("claimed");
        }
        setPreviewLoading(false);
      });
  }, [lead_id]);

  const handleClaim = async () => {
    if (claimLock.current || loading) return;
    claimLock.current = true;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-contractor-ppl-checkout", {
        body: { lead_id, contractor_id, contractor_email },
      });

      if (error) throw new Error(error.message);

      if (data?.error === "lead_claimed") {
        setStatus("claimed");
        toastInfo("This lead was just claimed by another contractor.");
      } else if (data?.error === "locked") {
        setMinutesLeft(data.minutesLeft || 10);
        setStatus("locked");
        toastInfo(
          `Another contractor is reviewing this lead. Try again in ~${data.minutesLeft || 10} min.`,
        );
      } else if (data?.url) {
        toastInfo("Locking lead — opening secure checkout…");
        window.location.href = data.url;
      } else {
        throw new Error("Unexpected response from server");
      }
    } catch (e) {
      setStatus("error");
      toastError(
        "Couldn't open checkout.",
        "Text Matt at (313) 992-1219 and we'll fix it instantly.",
      );
    } finally {
      setLoading(false);
      claimLock.current = false;
    }
  };

  // Missing or malformed query string — branded fallback, not a blank page.
  if (hasMissingParams) {
    return <LinkExpired variant="missing_params" />;
  }

  if (previewLoading) {
    return (
      <div style={{ minHeight: "100dvh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#00d4ff", fontSize: 18 }}>Loading lead…</div>
      </div>
    );
  }

  // Lead row not found in DB
  if (!leadPreview) {
    return <LinkExpired variant="not_found" />;
  }

  if (status === "claimed") {
    return <LinkExpired variant="claimed" />;
  }

  if (status === "locked") {
    return (
      <div style={{ minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⏳</div>
          <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 800, margin: "0 0 12px" }}>Being Reviewed</h1>
          <p style={{ color: "#94a3b8", fontSize: 16, lineHeight: 1.7, margin: "0 0 24px" }}>
            Another contractor is reviewing this lead right now. If they don't claim it,
            it'll unlock in approximately <strong style={{ color: "#00d4ff" }}>{minutesLeft} minute{minutesLeft !== 1 ? "s" : ""}</strong>.
          </p>
          <p style={{ color: "#64748b", fontSize: 14 }}>Check back soon or <a href="sms:+13139921219" style={{ color: "#00d4ff", textDecoration: "none" }}>text Matt at (313) 992-1219</a>.</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <div style={{ maxWidth: 480, width: "100%" }}>
        <div style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ background: "#00d4ff", height: 4 }} />
          <div style={{ padding: "32px 28px" }}>
            <div style={{ display: "inline-block", background: "rgba(239,68,68,0.15)", color: "#ef4444", fontSize: 12, fontWeight: 700, letterSpacing: 1, padding: "4px 10px", borderRadius: 4, marginBottom: 16 }}>
              🚨 EXCLUSIVE LEAD
            </div>
            <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 800, margin: "0 0 8px", lineHeight: 1.3 }}>
              {leadPreview?.trade} Lead in {leadPreview?.city}
            </h1>
            <p style={{ color: "#94a3b8", fontSize: 15, margin: "0 0 16px" }}>
              {leadPreview?.project_type}
            </p>

            {/* Items 35, 37, 38, 39, 45, 47 — quality badges (rendered only when data present) */}
            {leadPreview && (
              <div style={{ marginBottom: 20 }}>
                <LeadQualityBadges data={leadPreview} />
              </div>
            )}


            <div style={{ background: "#0a1628", borderRadius: 8, padding: "16px 20px", marginBottom: 24 }}>
              <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 8px" }}>What you get for $50:</p>
              <ul style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 2, margin: 0, paddingLeft: 20 }}>
                <li>Homeowner's full name</li>
                <li>Direct phone number</li>
                <li>Email address</li>
                <li>Project details</li>
              </ul>
              <p style={{ color: "#00d4ff", fontSize: 13, margin: "12px 0 0", fontWeight: 600 }}>
                100% exclusive — no other contractor receives this lead.
              </p>
              <p style={{ color: "#94a3b8", fontSize: 12, margin: "10px 0 0", lineHeight: 1.5 }}>
                If the number's disconnected or it's a fake lead, text Matt and we refund it. No forms.
              </p>
            </div>

            <ActionButton
              onClick={handleClaim}
              busyLabel="Locking lead..."
              ariaLabel="Pay $50 to claim this lead"
              style={{ padding: "18px", minHeight: 56, fontSize: 17 }}
            >
              Pay $50 — Get Their Phone Number
            </ActionButton>

            {status === "error" && (
              <p style={{ color: "#ef4444", fontSize: 13, textAlign: "center", marginTop: 12 }}>
                Something went wrong. Text Matt at (313) 992-1219.
              </p>
            )}

            <p style={{ color: "#475569", fontSize: 12, textAlign: "center", marginTop: 16 }}>
              One-time payment · No subscription required · Instant contact delivery
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// /claim-lead?lead_id=xxx&contractor_id=xxx&email=xxx
// Contractor lands here from FOMO teaser SMS.
// Shows lead preview (trade, city, project type — NO contact info) + $50 claim button.

import { useEffect, useState, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

export default function ClaimLead() {
  const [searchParams] = useSearchParams();
  const lead_id = searchParams.get("lead_id") || "";
  const contractor_id = searchParams.get("contractor_id") || "";
  const contractor_email = searchParams.get("email") || "";
  const hasMissingParams = !lead_id || !contractor_id || !contractor_email;

  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "locked" | "claimed" | "error">("idle");
  const [minutesLeft, setMinutesLeft] = useState(0);
  const [leadPreview, setLeadPreview] = useState<{ trade: string; city: string; project_type: string } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(!hasMissingParams);
  const claimLock = useRef(false);

  useEffect(() => {
    if (!lead_id) return;
    // Fetch non-sensitive lead preview
    supabase
      .from("contractor_leads")
      .select("project_type, status, contractor_lead_sites(trade, city)")
      .eq("id", lead_id)
      .single()
      .then(({ data }) => {
        if (data) {
          const site = (data as any).contractor_lead_sites;
          setLeadPreview({
            trade: site?.trade || "Service",
            city: site?.city || "Metro Detroit",
            project_type: (data as any).project_type || "Service request",
          });
          if ((data as any).status === "sold") setStatus("claimed");
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
      } else if (data?.error === "locked") {
        setMinutesLeft(data.minutesLeft || 10);
        setStatus("locked");
      } else if (data?.url) {
        window.location.href = data.url;
      }
    } catch (e) {
      setStatus("error");
    } finally {
      setLoading(false);
      claimLock.current = false;
    }
  };

  // Missing params error
  if (hasMissingParams) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 800, margin: "0 0 12px" }}>Invalid Link</h1>
          <p style={{ color: "#94a3b8", fontSize: 16, lineHeight: 1.7, margin: "0 0 32px" }}>
            This link is missing required information. Please use the link from your text message.
          </p>
          <p style={{ color: "#64748b", fontSize: 14 }}>Questions? Text Matt at (313) 992-1219</p>
        </div>
      </div>
    );
  }

  if (previewLoading) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ color: "#00d4ff", fontSize: 18 }}>Loading lead...</div>
      </div>
    );
  }

  // Invalid UUID or lead not found
  if (!leadPreview) {
    return (
      <div style={{ minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>🔍</div>
          <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 800, margin: "0 0 12px" }}>Lead Not Found</h1>
          <p style={{ color: "#94a3b8", fontSize: 16, lineHeight: 1.7, margin: "0 0 32px" }}>
            This lead may have expired or the link is incorrect. Check your latest text for a fresh link.
          </p>
          <p style={{ color: "#64748b", fontSize: 14 }}>Questions? Text Matt at (313) 992-1219</p>
        </div>
      </div>
    );
  }

  if (status === "claimed") {
    return (
      <div style={{ minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 56, marginBottom: 16 }}>😔</div>
          <h1 style={{ color: "#fff", fontSize: 28, fontWeight: 800, margin: "0 0 12px" }}>Lead Already Claimed</h1>
          <p style={{ color: "#94a3b8", fontSize: 16, lineHeight: 1.7, margin: "0 0 32px" }}>
            Another contractor got there first. We'll text you the next one as soon as it drops.
          </p>
          <p style={{ color: "#64748b", fontSize: 14 }}>Questions? Text Matt at (313) 992-1219</p>
        </div>
      </div>
    );
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
          <p style={{ color: "#64748b", fontSize: 14 }}>Check back soon or text Matt at (313) 992-1219.</p>
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
            <p style={{ color: "#94a3b8", fontSize: 15, margin: "0 0 24px" }}>
              {leadPreview?.project_type}
            </p>

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
            </div>

            <button
              onClick={handleClaim}
              disabled={loading}
              style={{
                width: "100%",
                background: loading ? "#334155" : "#00d4ff",
                color: loading ? "#94a3b8" : "#0a1628",
                border: "none",
                borderRadius: 8,
                padding: "16px",
                fontSize: 17,
                fontWeight: 800,
                cursor: loading ? "not-allowed" : "pointer",
                transition: "background 0.2s",
              }}
            >
              {loading ? "Locking lead..." : "Claim This Lead — $50"}
            </button>

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

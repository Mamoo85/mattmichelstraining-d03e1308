// /lead-unlocked?session_id=xxx
// Contractor lands here immediately after paying $50 on Stripe.
// Calls get-lead-by-session to display contact info instantly.
// Polls if webhook hasn't fired yet (202 pending).

import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import LeadQualityBadges, { LeadQualityData } from "@/components/contractor/LeadQualityBadges";

interface LeadData extends LeadQualityData {
  name: string;
  phone: string;
  email: string;
  project_type: string;
  message: string;
  trade: string;
  city: string;
  state: string;
  contact_preference: string;
}

export default function LeadUnlocked() {
  const [searchParams] = useSearchParams();
  const session_id = searchParams.get("session_id") || "";

  const [lead, setLead] = useState<LeadData | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "pending" | "error">("loading");
  const [pollCount, setPollCount] = useState(0);

  useEffect(() => {
    if (!session_id) {
      setStatus("error");
      return;
    }
    fetchLead();
  }, [session_id]);

  const fetchLead = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-lead-by-session?session_id=${encodeURIComponent(session_id)}`,
        {
          headers: {
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
        }
      );

      const json = await res.json();

      if (json.status === "ready" && json.lead) {
        setLead(json.lead);
        setStatus("ready");
      } else if (json.status === "pending") {
        setStatus("pending");
        // Poll up to 10 times (every 3 seconds) waiting for webhook
        if (pollCount < 10) {
          setTimeout(() => {
            setPollCount((c) => c + 1);
            fetchLead();
          }, 3000);
        }
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  if (status === "loading" || status === "pending") {
    return (
      <div style={{ minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚡</div>
          <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 800, margin: "0 0 12px" }}>Payment Confirmed</h1>
          <p style={{ color: "#00d4ff", fontSize: 16, margin: "0 0 8px" }}>Unlocking your lead...</p>
          <p style={{ color: "#64748b", fontSize: 14 }}>This takes just a moment.</p>
          <div style={{ marginTop: 24, display: "flex", justifyContent: "center", gap: 8 }}>
            {[0, 1, 2].map((i) => (
              <div key={i} style={{
                width: 8, height: 8, borderRadius: "50%", background: "#00d4ff",
                animation: `pulse 1.2s ease-in-out ${i * 0.4}s infinite`,
              }} />
            ))}
          </div>
          <style>{`@keyframes pulse { 0%,100%{opacity:.3;transform:scale(0.8)} 50%{opacity:1;transform:scale(1.2)} }`}</style>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div style={{ minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
          <h1 style={{ color: "#fff", fontSize: 26, fontWeight: 800, margin: "0 0 12px" }}>Check Your SMS</h1>
          <p style={{ color: "#94a3b8", fontSize: 15, lineHeight: 1.7, margin: "0 0 24px" }}>
            Your payment went through. We texted the lead's contact info to your phone. Check your messages.
          </p>
          <p style={{ color: "#64748b", fontSize: 14 }}>
            Need help? Text Matt at <a href="tel:+13139921219" style={{ color: "#00d4ff" }}>(313) 992-1219</a>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <div style={{ maxWidth: 520, width: "100%" }}>
        <div style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ background: "#00d4ff", height: 4 }} />
          <div style={{ padding: "32px 28px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
              <div style={{ background: "rgba(0,212,255,0.15)", borderRadius: "50%", width: 48, height: 48, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24 }}>✅</div>
              <div>
                <p style={{ color: "#00d4ff", fontSize: 13, fontWeight: 700, margin: 0, letterSpacing: 0.5 }}>LEAD UNLOCKED</p>
                <h1 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: 0 }}>Call them now</h1>
              </div>
            </div>

            <div style={{ background: "#0a1628", borderRadius: 10, padding: "20px 24px", marginBottom: 24 }}>
              <div style={{ display: "grid", gap: 16 }}>
                <div>
                  <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 4px", fontWeight: 600, letterSpacing: 0.5 }}>NAME</p>
                  <p style={{ color: "#fff", fontSize: 20, fontWeight: 800, margin: 0 }}>{lead?.name}</p>
                </div>
                <div>
                  <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 4px", fontWeight: 600, letterSpacing: 0.5 }}>PHONE</p>
                  <a href={`tel:${lead?.phone}`} style={{ color: "#00d4ff", fontSize: 22, fontWeight: 800, textDecoration: "none", display: "block" }}>
                    {lead?.phone}
                  </a>
                </div>
                {lead?.email && (
                  <div>
                    <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 4px", fontWeight: 600, letterSpacing: 0.5 }}>EMAIL</p>
                    <a href={`mailto:${lead.email}`} style={{ color: "#94a3b8", fontSize: 15, textDecoration: "none" }}>{lead.email}</a>
                  </div>
                )}
                {lead?.project_type && (
                  <div>
                    <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 4px", fontWeight: 600, letterSpacing: 0.5 }}>PROJECT</p>
                    <p style={{ color: "#e2e8f0", fontSize: 15, margin: 0 }}>{lead.project_type}</p>
                  </div>
                )}
                {lead?.contact_preference && (
                  <div>
                    <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 4px", fontWeight: 600, letterSpacing: 0.5 }}>PREFERRED CONTACT</p>
                    <p style={{ color: "#00d4ff", fontSize: 15, fontWeight: 700, margin: 0 }}>{lead.contact_preference}</p>
                  </div>
                )}
                {lead?.message && (
                  <div>
                    <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 4px", fontWeight: 600, letterSpacing: 0.5 }}>NOTES</p>
                    <p style={{ color: "#94a3b8", fontSize: 14, margin: 0, lineHeight: 1.6 }}>{lead.message}</p>
                  </div>
                )}
              </div>
            </div>

            <a
              href={`tel:${lead?.phone}`}
              style={{
                display: "block", width: "100%", background: "#00d4ff", color: "#0a1628",
                borderRadius: 8, padding: "15px", fontSize: 17, fontWeight: 800,
                textAlign: "center", textDecoration: "none", boxSizing: "border-box",
              }}
            >
              📞 Call {lead?.name?.split(" ")[0]} Now
            </a>

            <p style={{ color: "#475569", fontSize: 12, textAlign: "center", marginTop: 16 }}>
              A receipt was also texted and emailed to you. This lead is 100% exclusive.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

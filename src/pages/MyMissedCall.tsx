import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";

import ManageBillingButton from "@/components/billing/ManageBillingButton";
import OnboardingChecklist from "@/components/shared/OnboardingChecklist";

type MCClient = {
  business_name: string;
  contact_name: string | null;
  response_message: string | null;
  call_count: number;
  text_count: number;
  active: boolean;
  created_at: string;
  email: string | null;
};

type Capture = {
  id: string;
  caller_number: string;
  city: string | null;
  voicemail_transcript: string | null;
  recording_url: string | null;
  recording_duration: number | null;
  text_sent: string | null;
  reply_received: string | null;
  status: string;
  created_at: string;
};

const STATUS_COLORS: Record<string, { bg: string; fg: string; label: string }> = {
  new: { bg: "#1e1a2e", fg: "#a78bfa", label: "NEW" },
  texted: { bg: "#0d2a4d", fg: "#60a5fa", label: "TEXTED" },
  replied: { bg: "#064e3b", fg: "#34d399", label: "REPLIED" },
  callback_scheduled: { bg: "#422006", fg: "#fbbf24", label: "CALLBACK" },
  closed: { bg: "#1f2937", fg: "#9ca3af", label: "CLOSED" },
};

function formatPhone(p: string): string {
  const digits = p.replace(/\D/g, "").replace(/^1/, "");
  if (digits.length !== 10) return p;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function MyMissedCall() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [client, setClient] = useState<MCClient | null>(null);
  const [captures, setCaptures] = useState<Capture[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) {
      setError("Missing dashboard token. Check your welcome email for your dashboard link.");
      setLoading(false);
      return;
    }
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-my-missed-call?token=${encodeURIComponent(token)}`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.client) {
          setClient(d.client);
          setCaptures(d.captures || []);
        } else setError("Dashboard not found. Check your welcome email for the correct link.");
      })
      .catch(() => setError("Could not load dashboard. Try refreshing."))
      .finally(() => setLoading(false));
  }, [token]);

  return (
    <>
      <Helmet>
        <title>Missed Call Catch — Your Dashboard | Detroit Web Agency</title>
      </Helmet>
      <div style={{ minHeight: "100vh", background: "#030711", fontFamily: "-apple-system,sans-serif", padding: "32px 16px" }}>
        <div style={{ maxWidth: 720, margin: "0 auto" }}>
          <p style={{ color: "#00d4ff", fontSize: 11, fontWeight: 800, letterSpacing: 4, textTransform: "uppercase", margin: "0 0 8px" }}>📞 MISSED CALL CATCH</p>
          <h1 style={{ color: "#fff", fontSize: 26, margin: "0 0 4px" }}>Your Dashboard</h1>
          <p style={{ color: "#64748b", fontSize: 13, margin: "0 0 32px" }}>Detroit Web Agency · (313) 992-1219</p>

          {loading && <p style={{ color: "#94a3b8" }}>Loading…</p>}
          {error && (
            <div style={{ background: "#1e1a2e", border: "1px solid #7c3aed", borderRadius: 12, padding: 24 }}>
              <p style={{ color: "#f87171", margin: 0 }}>{error}</p>
              <p style={{ color: "#64748b", fontSize: 12, margin: "12px 0 0" }}>Need help? Text Matt at (313) 992-1219</p>
            </div>
          )}

          {client && (
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <OnboardingChecklist
                product="Missed Call Catch"
                steps={[
                  { id: "active", label: "Service active", done: client.active, hint: "Active subscription confirmed." },
                  { id: "msg", label: "Response message customized", done: !!client.response_message, hint: "Reply to your welcome email to update." },
                  { id: "first", label: "First missed call captured", done: client.call_count > 0, hint: "Will fire automatically next time someone calls and you don't pick up." },
                  { id: "first-text", label: "First text-back sent", done: client.text_count > 0, hint: "Auto-sent the moment a call is missed." },
                ]}
              />

              {/* Status card */}
              <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 14, padding: 24 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                  <span style={{ color: "#94a3b8", fontSize: 12, textTransform: "uppercase", letterSpacing: 1 }}>Service Status</span>
                  <span style={{ background: client.active ? "#064e3b" : "#450a0a", color: client.active ? "#34d399" : "#f87171", fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 20 }}>
                    {client.active ? "ACTIVE" : "INACTIVE"}
                  </span>
                </div>
                <p style={{ color: "#fff", fontWeight: 700, fontSize: 18, margin: 0 }}>{client.business_name}</p>
                {client.contact_name && <p style={{ color: "#64748b", fontSize: 13, margin: "4px 0 0" }}>{client.contact_name}</p>}
              </div>

              {/* Stats */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 14, padding: 20, textAlign: "center" }}>
                  <p style={{ color: "#00d4ff", fontSize: 32, fontWeight: 800, margin: "0 0 4px" }}>{client.call_count}</p>
                  <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>Calls Caught</p>
                </div>
                <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 14, padding: 20, textAlign: "center" }}>
                  <p style={{ color: "#00d4ff", fontSize: 32, fontWeight: 800, margin: "0 0 4px" }}>{client.text_count}</p>
                  <p style={{ color: "#64748b", fontSize: 12, margin: 0 }}>Texts Sent</p>
                </div>
              </div>

              {/* Call log */}
              <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 14, padding: 20 }}>
                <p style={{ color: "#94a3b8", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 12px" }}>
                  Recent Missed Calls ({captures.length})
                </p>
                {captures.length === 0 ? (
                  <p style={{ color: "#64748b", fontSize: 13, margin: 0, padding: "12px 0" }}>
                    No missed calls captured yet. The next time someone calls and you don't answer, the system will text them back automatically and log the call here.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {captures.map((c) => {
                      const sc = STATUS_COLORS[c.status] || STATUS_COLORS.new;
                      return (
                        <div key={c.id} style={{ background: "#030711", border: "1px solid #1e3a5f", borderRadius: 10, padding: 14 }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginBottom: 6 }}>
                            <a href={`tel:${c.caller_number}`} style={{ color: "#fff", fontWeight: 700, fontSize: 15, textDecoration: "none" }}>
                              {formatPhone(c.caller_number)}
                            </a>
                            <span style={{ background: sc.bg, color: sc.fg, fontSize: 9, fontWeight: 800, padding: "3px 8px", borderRadius: 12, letterSpacing: 0.5 }}>
                              {sc.label}
                            </span>
                          </div>
                          <p style={{ color: "#64748b", fontSize: 11, margin: "0 0 8px" }}>
                            {c.city ? `${c.city} · ` : ""}{timeAgo(c.created_at)}
                          </p>
                          {c.voicemail_transcript && (
                            <p style={{ color: "#cbd5e1", fontSize: 12, margin: "0 0 6px", fontStyle: "italic", borderLeft: "2px solid #00d4ff", paddingLeft: 10 }}>
                              "{c.voicemail_transcript}"
                            </p>
                          )}
                          {c.text_sent && (
                            <p style={{ color: "#94a3b8", fontSize: 11, margin: "4px 0 0" }}>
                              <span style={{ color: "#00d4ff" }}>Sent:</span> {c.text_sent}
                            </p>
                          )}
                          {c.reply_received && (
                            <p style={{ color: "#34d399", fontSize: 11, margin: "4px 0 0" }}>
                              <span style={{ color: "#00d4ff" }}>Reply:</span> {c.reply_received}
                            </p>
                          )}
                          <div style={{ marginTop: 8, display: "flex", gap: 8 }}>
                            <a href={`tel:${c.caller_number}`} style={{ background: "#00d4ff", color: "#000", fontWeight: 700, fontSize: 11, padding: "5px 10px", borderRadius: 6, textDecoration: "none" }}>
                              📞 Call back
                            </a>
                            <a href={`sms:${c.caller_number}`} style={{ background: "#1e3a5f", color: "#fff", fontWeight: 700, fontSize: 11, padding: "5px 10px", borderRadius: 6, textDecoration: "none" }}>
                              💬 Text
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Response message */}
              <div style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 14, padding: 24 }}>
                <p style={{ color: "#94a3b8", fontSize: 12, textTransform: "uppercase", letterSpacing: 1, margin: "0 0 10px" }}>Current Response Message</p>
                <p style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.6, margin: "0 0 16px", background: "#0d1f3c", padding: "12px 16px", borderRadius: 8, borderLeft: "3px solid #00d4ff" }}>
                  {client.response_message || "Hey! I just missed your call — I'll call you right back. How can I help you?"}
                </p>
                <p style={{ color: "#475569", fontSize: 12, margin: 0 }}>
                  To update this message, reply to your welcome email or text Matt at{" "}
                  <a href="tel:+13139921219" style={{ color: "#00d4ff" }}>(313) 992-1219</a>
                </p>
              </div>

              <p style={{ color: "#334155", fontSize: 11, textAlign: "center", margin: "8px 0 0" }}>
                Active since {new Date(client.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>

              {client.email && (
                <div style={{ marginTop: 16, display: "flex", justifyContent: "center" }}>
                  <ManageBillingButton email={client.email} />
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

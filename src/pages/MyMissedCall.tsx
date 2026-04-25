import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Helmet } from "react-helmet-async";

type MCClient = {
  business_name: string;
  contact_name: string | null;
  response_message: string | null;
  call_count: number;
  text_count: number;
  active: boolean;
  created_at: string;
};

export default function MyMissedCall() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const [client, setClient] = useState<MCClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!token) { setError("Missing dashboard token. Check your welcome email for your dashboard link."); setLoading(false); return; }
    fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-my-missed-call?token=${encodeURIComponent(token)}`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY },
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.client) setClient(d.client);
        else setError("Dashboard not found. Check your welcome email for the correct link.");
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
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
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
            </div>
          )}
        </div>
      </div>
    </>
  );
}

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export default function BillingPortal() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // If user is logged in, grab their email automatically
  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (data.user?.email) setEmail(data.user.email);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: fnErr } = await supabase.functions.invoke("create-customer-portal-session", {
        body: { email },
      });
      if (fnErr || !data?.url) {
        setError("We couldn't find a billing account for that email. Reply to any of our emails or text (313) 992-1219.");
        setLoading(false);
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("Something went wrong. Text (313) 992-1219 and we'll fix it right away.");
      setLoading(false);
    }
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", padding: "24px" }}>
      <div style={{ maxWidth: 420, width: "100%", background: "#0f2540", border: "1px solid #1e3a5f", borderRadius: 12, padding: "32px 28px" }}>
        <h1 style={{ color: "#00d4ff", fontSize: 22, fontWeight: 700, marginBottom: 8 }}>Manage Your Billing</h1>
        <p style={{ color: "#94a3b8", fontSize: 14, marginBottom: 24 }}>
          Enter the email on your Detroit Web Agency account to open the Stripe billing portal — update your card, view invoices, or cancel.
        </p>
        <form onSubmit={handleSubmit}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            style={{ width: "100%", padding: "10px 14px", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 8, color: "#e2e8f0", fontSize: 15, marginBottom: 16, boxSizing: "border-box" }}
          />
          <button
            type="submit"
            disabled={loading || !email}
            style={{ width: "100%", padding: "12px", background: loading ? "#1e3a5f" : "#00d4ff", color: "#0a1628", fontWeight: 700, fontSize: 15, border: "none", borderRadius: 8, cursor: loading ? "not-allowed" : "pointer" }}
          >
            {loading ? "Loading…" : "Open Billing Portal →"}
          </button>
        </form>
        {error && <p style={{ color: "#f87171", fontSize: 13, marginTop: 16 }}>{error}</p>}
        <p style={{ color: "#64748b", fontSize: 12, marginTop: 20 }}>
          Need help? Text or call (313) 992-1219.
        </p>
      </div>
    </div>
  );
}

import { useState } from "react";
import { CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = { email: string };

export default function ManageBillingButton({ email }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleClick = async () => {
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      const { data, error: err } = await supabase.functions.invoke("create-customer-portal-session", {
        body: { email },
      });
      if (err || data?.error) throw new Error(err?.message || data?.error || "Could not open billing portal");
      if (data?.url) window.location.href = data.url;
      else throw new Error("No portal URL returned");
    } catch (e: any) {
      setError(e?.message ?? "Could not open billing portal");
      setLoading(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
      <button
        onClick={handleClick}
        disabled={loading || !email}
        style={{
          background: "transparent",
          border: "1px solid #1e3a5f",
          color: "#94a3b8",
          fontSize: 13,
          padding: "8px 14px",
          borderRadius: 8,
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          cursor: loading ? "wait" : "pointer",
          opacity: loading ? 0.6 : 1,
        }}
      >
        <CreditCard className="h-3.5 w-3.5" />
        {loading ? "Opening…" : "Manage billing"}
      </button>
      {error && <p style={{ color: "#f87171", fontSize: 11, margin: 0 }}>{error}</p>}
    </div>
  );
}

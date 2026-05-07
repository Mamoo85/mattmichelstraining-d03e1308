import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Mail, CheckCircle2, AlertCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  /** Optional product label shown in messaging */
  product?: string;
};

/**
 * Drop into post-checkout success blocks. Reads ?session_id= and calls
 * the `claim-session` edge function to send a magic-link login email.
 */
export default function PostCheckoutClaim({ product }: Props) {
  const [params] = useSearchParams();
  const sessionId = params.get("session_id");
  const [status, setStatus] = useState<"idle" | "loading" | "sent" | "error">("idle");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!sessionId) return;
    const guardKey = `pcc_claimed_${sessionId}`;
    let cancelled = false;
    (async () => {
      // Idempotency guard: don't re-fire claim-session on page refresh.
      try {
        if (typeof window !== "undefined" && window.localStorage.getItem(guardKey)) {
          setStatus("sent");
          return;
        }
      } catch {
        /* localStorage unavailable — fall through */
      }
      setStatus("loading");
      try {
        const { data, error: err } = await supabase.functions.invoke("claim-session", {
          body: { session_id: sessionId },
        });
        if (cancelled) return;
        if (err || (data && data.error)) {
          setError((err?.message || data?.error) ?? "Could not send login link.");
          setStatus("error");
        } else {
          setStatus("sent");
        }
      } catch (e: any) {
        if (cancelled) return;
        setError(e?.message ?? "Could not send login link.");
        setStatus("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (!sessionId) return null;

  return (
    <div
      style={{
        background: "#0a1628",
        border: "1px solid #1e3a5f",
        borderRadius: 14,
        padding: 24,
        display: "flex",
        gap: 14,
        alignItems: "flex-start",
        marginTop: 16,
      }}
    >
      {status === "sent" ? (
        <CheckCircle2 className="h-6 w-6" style={{ color: "#34d399", flexShrink: 0 }} />
      ) : status === "error" ? (
        <AlertCircle className="h-6 w-6" style={{ color: "#f87171", flexShrink: 0 }} />
      ) : (
        <Mail className="h-6 w-6 animate-spin" style={{ color: "#00d4ff", flexShrink: 0 }} />
      )}
      <div style={{ flex: 1 }}>
        {status === "loading" && (
          <p style={{ color: "#e2e8f0", margin: 0, fontSize: 14 }}>
            Setting up your {product ?? "account"}…
          </p>
        )}
        {status === "sent" && (
          <>
            <p style={{ color: "#fff", margin: 0, fontWeight: 700 }}>Check your inbox</p>
            <p style={{ color: "#94a3b8", margin: "4px 0 0", fontSize: 13 }}>
              We sent you a one-tap login link to access your dashboard.
            </p>
          </>
        )}
        {status === "error" && (
          <>
            <p style={{ color: "#fff", margin: 0, fontWeight: 700 }}>Something went wrong</p>
            <p style={{ color: "#94a3b8", margin: "4px 0 0", fontSize: 13 }}>
              {error} Text Matt at (313) 992-1219 and we'll get you in.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

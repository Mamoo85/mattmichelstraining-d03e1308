import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const BG = "#0a1628";
const ACCENT = "#00d4ff";
const SURFACE = "#0d1f3c";
const BORDER = "#1e3a5f";

interface SetupData {
  business_name: string;
  contact_name: string | null;
  twilio_number: string | null;
  business_phone: string | null;
  status: "live" | "awaiting_forwarding" | "provisioning_failed";
}

export default function MissedCallSetup() {
  const params = new URLSearchParams(window.location.search);
  const token = params.get("token") || "";
  const [data, setData] = useState<SetupData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [testing, setTesting] = useState(false);
  const [retrying, setRetrying] = useState(false);

  useEffect(() => {
    if (!token) {
      setError("No setup token provided. Check your welcome email for the setup link.");
      setLoading(false);
      return;
    }
    void load();
  }, [token]);

  async function load() {
    setLoading(true);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("get-missed-call-setup", {
        method: "GET" as never,
        body: undefined,
        // Pass token via query string by hitting full URL
      });
      // Edge function reads token from URL; use raw fetch for query string compatibility
      const r = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/get-missed-call-setup?token=${encodeURIComponent(token)}`,
        { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } },
      );
      const json = await r.json();
      if (!r.ok) throw new Error(json.error || "Failed to load setup");
      setData(json);
      void res; void err;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }

  async function sendTest() {
    setTesting(true);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("send-missed-call-test", {
        body: { token },
      });
      if (err || !res?.success) throw new Error(res?.error || err?.message || "Test failed");
      toast.success("Test text sent! Check your phone.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  async function retryProvision() {
    setRetrying(true);
    try {
      const { data: res, error: err } = await supabase.functions.invoke("retry-missed-call-provision", {
        body: { token },
      });
      if (err || !res?.success) throw new Error(res?.error || err?.message || "Retry failed");
      toast.success(`Provisioned ${res.twilio_number}!`);
      await load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Retry failed");
    } finally {
      setRetrying(false);
    }
  }

  function copy(text: string, label: string) {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied`);
  }

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: BG, color: "#94a3b8", display: "flex", alignItems: "center", justifyContent: "center" }}>
        Loading…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={{ minHeight: "100vh", background: BG, color: "#fff", padding: 40, textAlign: "center" }}>
        <h1 style={{ color: ACCENT }}>Setup Link Issue</h1>
        <p style={{ color: "#94a3b8" }}>{error || "Unknown error"}</p>
        <p style={{ color: "#94a3b8", marginTop: 24 }}>
          Email <a href="mailto:matt@detroitwebagent.com" style={{ color: ACCENT }}>matt@detroitwebagent.com</a> for help.
        </p>
      </div>
    );
  }

  const num = data.twilio_number || "";
  const cleanNum = num.replace(/\D/g, "");
  const noAnswerCode = cleanNum ? `**61*${cleanNum}*11*20#` : "";
  const busyCode = cleanNum ? `**67*${cleanNum}#` : "";

  const statusBadge = data.status === "live"
    ? { color: "#10b981", bg: "#10b98120", label: "🟢 Live — texts firing" }
    : data.status === "awaiting_forwarding"
    ? { color: "#f59e0b", bg: "#f59e0b20", label: "🟡 Awaiting forwarding setup" }
    : { color: "#ef4444", bg: "#ef444420", label: "🔴 Number not provisioned" };

  return (
    <div style={{ minHeight: "100vh", background: BG, color: "#e2e8f0", padding: "32px 16px" }}>
      <div style={{ maxWidth: 640, margin: "0 auto" }}>
        <div style={{ marginBottom: 24, textAlign: "center" }}>
          <p style={{ color: ACCENT, fontSize: 11, fontWeight: 700, letterSpacing: 3, textTransform: "uppercase", margin: 0 }}>
            Missed Call Text-Back
          </p>
          <h1 style={{ fontSize: 28, fontWeight: 900, color: "#fff", margin: "8px 0 4px" }}>
            Setup Wizard
          </h1>
          <p style={{ color: "#94a3b8", margin: 0 }}>{data.business_name}</p>
        </div>

        {/* Trial banner */}
        <div style={{ background: "#10b98115", border: "1px solid #10b98140", borderRadius: 10, padding: "10px 14px", marginBottom: 16, textAlign: "center" }}>
          <p style={{ color: "#10b981", fontSize: 12, fontWeight: 700, margin: 0 }}>
            ✅ You're on day 1 of 14 — no card charged yet. Cancel before day 14 and you're never billed.
          </p>
        </div>

        {/* Progress bar */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 20 }}>
          {[
            { n: 1, label: "Confirm number", done: !!data.twilio_number },
            { n: 2, label: "Customize text", done: data.status === "live" },
            { n: 3, label: "Done", done: data.status === "live" },
          ].map((step, i, arr) => (
            <div key={step.n} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: step.done ? ACCENT : SURFACE,
                border: `1px solid ${step.done ? ACCENT : BORDER}`,
                color: step.done ? BG : "#94a3b8",
                fontSize: 11, fontWeight: 800,
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>{step.done ? "✓" : step.n}</div>
              <span style={{ color: step.done ? "#fff" : "#94a3b8", fontSize: 11, fontWeight: 600 }}>{step.label}</span>
              {i < arr.length - 1 && <span style={{ color: "#475569" }}>→</span>}
            </div>
          ))}
        </div>

        <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, marginBottom: 16 }}>
          <div style={{ display: "inline-block", background: statusBadge.bg, color: statusBadge.color, padding: "6px 12px", borderRadius: 6, fontWeight: 700, fontSize: 13, marginBottom: 16 }}>
            {statusBadge.label}
          </div>

          {data.status === "provisioning_failed" ? (
            <div>
              <p style={{ color: "#94a3b8", marginBottom: 16 }}>
                Your number didn't provision automatically. Tap the button below to retry.
              </p>
              <button
                onClick={retryProvision}
                disabled={retrying}
                style={{ width: "100%", background: ACCENT, color: BG, padding: "14px", borderRadius: 8, fontWeight: 800, border: "none", fontSize: 16, cursor: "pointer" }}
              >
                {retrying ? "Provisioning…" : "🔄 Retry Provisioning"}
              </button>
            </div>
          ) : (
            <>
              <p style={{ color: "#94a3b8", fontSize: 13, margin: "0 0 8px" }}>YOUR DEDICATED TEXT-BACK NUMBER</p>
              <div
                onClick={() => copy(num, "Number")}
                style={{ background: BG, border: `1px solid ${ACCENT}40`, borderRadius: 8, padding: 16, cursor: "pointer", textAlign: "center" }}
              >
                <div style={{ color: ACCENT, fontSize: 24, fontWeight: 900, fontFamily: "monospace" }}>{num}</div>
                <div style={{ color: "#94a3b8", fontSize: 11, marginTop: 4 }}>tap to copy</div>
              </div>
            </>
          )}
        </div>

        {data.status !== "provisioning_failed" && (
          <>
            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: "0 0 12px" }}>📱 Forward Your Calls (2 min)</h2>
              <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 16px" }}>
                On the phone you want to forward FROM (your business line), open the dialer and tap each code:
              </p>

              <div style={{ marginBottom: 12 }}>
                <p style={{ color: "#cbd5e1", fontSize: 13, margin: "0 0 6px", fontWeight: 600 }}>When unanswered (after 20 sec)</p>
                <div
                  onClick={() => copy(noAnswerCode, "Code")}
                  style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, cursor: "pointer", fontFamily: "monospace", color: ACCENT, fontSize: 16, textAlign: "center" }}
                >
                  {noAnswerCode}
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <p style={{ color: "#cbd5e1", fontSize: 13, margin: "0 0 6px", fontWeight: 600 }}>When line is busy</p>
                <div
                  onClick={() => copy(busyCode, "Code")}
                  style={{ background: BG, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 12, cursor: "pointer", fontFamily: "monospace", color: ACCENT, fontSize: 16, textAlign: "center" }}
                >
                  {busyCode}
                </div>
              </div>

              <p style={{ color: "#94a3b8", fontSize: 12, margin: 0 }}>
                💡 Tap each code, then tap "call." You'll hear a confirmation tone — that's it. To turn it off later: dial <code style={{ color: ACCENT }}>##61#</code> and <code style={{ color: ACCENT }}>##67#</code>.
              </p>
            </div>

            <div style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, marginBottom: 16 }}>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: "0 0 8px" }}>✅ Verify It Works</h2>
              <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 16px" }}>
                We'll send a test text to <strong style={{ color: "#fff" }}>{data.business_phone || "your phone"}</strong>.
              </p>
              <button
                onClick={sendTest}
                disabled={testing || !data.business_phone}
                style={{ width: "100%", background: ACCENT, color: BG, padding: "14px", borderRadius: 8, fontWeight: 800, border: "none", fontSize: 16, cursor: testing ? "not-allowed" : "pointer", opacity: testing ? 0.6 : 1 }}
              >
                {testing ? "Sending…" : "📱 Send me a test text"}
              </button>
            </div>
          </>
        )}

        <div style={{ textAlign: "center", color: "#64748b", fontSize: 13, marginTop: 24 }}>
          Need help? Email <a href="mailto:matt@detroitwebagent.com" style={{ color: ACCENT }}>matt@detroitwebagent.com</a> or text (313) 992-1219
        </div>
      </div>
    </div>
  );
}

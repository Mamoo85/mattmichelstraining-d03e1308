import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Search, CheckCircle, AlertTriangle, XCircle, Lock } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;

interface SeoHealthResult {
  score: number;
  title?: string;
  title_length?: number;
  description_length?: number;
  h1_count?: number;
  word_count?: number;
  images_without_alt?: number;
  has_canonical?: boolean;
  status_code?: number;
  error?: string;
}

type PageState = "idle" | "loading" | "teaser" | "success";

function ScoreGauge({ score }: { score: number }) {
  const color = score >= 70 ? "#22c55e" : score >= 40 ? "#f59e0b" : "#ef4444";
  const label = score >= 70 ? "Good" : score >= 40 ? "Needs Work" : "Critical Issues";
  return (
    <div style={{ textAlign: "center", padding: "24px 0" }}>
      <div
        style={{
          display: "inline-flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          width: 120,
          height: 120,
          borderRadius: "50%",
          border: `8px solid ${color}`,
          background: "#fff",
        }}
      >
        <span style={{ fontSize: 36, fontWeight: 900, color, lineHeight: 1 }}>{score}</span>
        <span style={{ fontSize: 11, color: "#6b7280", marginTop: 2 }}>/ 100</span>
      </div>
      <p style={{ margin: "8px 0 0", fontSize: 14, fontWeight: 700, color }}>{label}</p>
    </div>
  );
}

function IssueRow({
  label,
  value,
  status,
  blurred,
}: {
  label: string;
  value?: string;
  status?: "ok" | "warn" | "error";
  blurred?: boolean;
}) {
  const icon =
    status === "ok" ? (
      <CheckCircle size={16} color="#22c55e" />
    ) : status === "warn" ? (
      <AlertTriangle size={16} color="#f59e0b" />
    ) : (
      <XCircle size={16} color="#ef4444" />
    );

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "10px 0",
        borderBottom: "1px solid #f3f4f6",
        filter: blurred ? "blur(4px)" : "none",
        userSelect: blurred ? "none" : undefined,
      }}
    >
      {blurred ? <Lock size={16} color="#9ca3af" /> : icon}
      <span style={{ flex: 1, fontSize: 14, color: "#374151" }}>{label}</span>
      {!blurred && value && (
        <span style={{ fontSize: 13, color: "#6b7280", fontWeight: 600 }}>{value}</span>
      )}
      {blurred && (
        <span
          style={{
            fontSize: 13,
            color: "#9ca3af",
            background: "#e5e7eb",
            borderRadius: 4,
            padding: "1px 8px",
          }}
        >
          ████
        </span>
      )}
    </div>
  );
}

export default function SeoAudit() {
  const [searchParams] = useSearchParams();
  const [pageState, setPageState] = useState<PageState>(
    searchParams.get("success") === "1" ? "success" : "idle"
  );
  const [url, setUrl] = useState("");
  const [email, setEmail] = useState("");
  const [result, setResult] = useState<SeoHealthResult | null>(null);
  const [checkoutLoading, setCheckoutLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (searchParams.get("success") === "1") {
      setPageState("success");
    }
  }, [searchParams]);

  async function runFreeScan(e: React.FormEvent) {
    e.preventDefault();
    if (!url || !email) return;
    setError(null);
    setPageState("loading");

    try {
      const normalizedUrl =
        url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/free-seo-health-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: normalizedUrl, email }),
      });

      const data: SeoHealthResult = await res.json();

      if (!res.ok || data.error) {
        throw new Error(data.error || "Scan failed. Please try again.");
      }

      setResult(data);
      setPageState("teaser");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong. Please try again.";
      setError(msg);
      setPageState("idle");
    }
  }

  async function startCheckout() {
    if (!email || !url) return;
    setCheckoutLoading(true);
    setError(null);

    try {
      const normalizedUrl =
        url.startsWith("http://") || url.startsWith("https://") ? url : `https://${url}`;

      const res = await fetch(`${SUPABASE_URL}/functions/v1/create-seo-audit-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          business_name: normalizedUrl,
          city: "Michigan",
          website_url: normalizedUrl,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.url) {
        throw new Error(data.error || "Checkout failed. Please try again.");
      }

      window.location.href = data.url;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Checkout failed. Please try again.";
      setError(msg);
      setCheckoutLoading(false);
    }
  }

  // ── SUCCESS STATE ──────────────────────────────────────────────────────────
  if (pageState === "success") {
    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f9fafb",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px 16px",
        }}
      >
        <div
          style={{
            maxWidth: 520,
            width: "100%",
            background: "#fff",
            border: "1px solid #e5e7eb",
            borderRadius: 16,
            padding: "40px 32px",
            textAlign: "center",
          }}
        >
          <CheckCircle size={56} color="#22c55e" style={{ marginBottom: 16 }} />
          <h1 style={{ fontSize: 26, fontWeight: 900, color: "#111827", margin: "0 0 12px" }}>
            Your full audit is on its way!
          </h1>
          <p style={{ fontSize: 15, color: "#6b7280", lineHeight: 1.7, margin: "0 0 24px" }}>
            Check your inbox within a few minutes. The report includes every issue we found, keyword gaps, a competitor snapshot, and 10 prioritized action items.
          </p>
          <a
            href="https://detroitwebagent.com"
            style={{
              display: "inline-block",
              background: "#0369a1",
              color: "#fff",
              padding: "12px 28px",
              borderRadius: 8,
              textDecoration: "none",
              fontWeight: 700,
              fontSize: 14,
            }}
          >
            Learn About Detroit Web Agency →
          </a>
        </div>
      </div>
    );
  }

  // ── TEASER STATE ──────────────────────────────────────────────────────────
  if (pageState === "teaser" && result) {
    const titleStatus =
      !result.title_length
        ? "error"
        : result.title_length < 30 || result.title_length > 60
        ? "warn"
        : "ok";
    const h1Status =
      result.h1_count === 1 ? "ok" : result.h1_count === 0 ? "error" : "warn";
    const altStatus =
      (result.images_without_alt ?? 0) === 0
        ? "ok"
        : (result.images_without_alt ?? 0) < 3
        ? "warn"
        : "error";

    return (
      <div
        style={{
          minHeight: "100vh",
          background: "#f9fafb",
          padding: "32px 16px",
          fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        }}
      >
        <div style={{ maxWidth: 600, margin: "0 auto" }}>
          {/* Header */}
          <div style={{ textAlign: "center", marginBottom: 24 }}>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: "#111827", margin: "0 0 4px" }}>
              Your Free SEO Score
            </h1>
            <p style={{ fontSize: 14, color: "#6b7280", margin: 0 }}>{url}</p>
          </div>

          {/* Score gauge */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              marginBottom: 16,
            }}
          >
            <ScoreGauge score={result.score} />
          </div>

          {/* Visible issues */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 16,
            }}
          >
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 12,
                fontWeight: 700,
                color: "#374151",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              On-Page Check (3 of 12 findings)
            </p>
            <IssueRow
              label="Page title length"
              value={result.title_length ? `${result.title_length} chars` : "Missing"}
              status={titleStatus}
            />
            <IssueRow
              label="H1 heading"
              value={
                result.h1_count === 1
                  ? "Found (good)"
                  : result.h1_count === 0
                  ? "Missing"
                  : `${result.h1_count} found (too many)`
              }
              status={h1Status}
            />
            <IssueRow
              label="Images missing alt text"
              value={`${result.images_without_alt ?? 0} image${(result.images_without_alt ?? 0) !== 1 ? "s" : ""}`}
              status={altStatus}
            />
          </div>

          {/* Blurred locked sections */}
          <div
            style={{
              background: "#fff",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: "16px 20px",
              marginBottom: 16,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 12,
                fontWeight: 700,
                color: "#374151",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Full Report (locked)
            </p>
            <IssueRow label="Keyword gap analysis — 5 missed opportunities" blurred />
            <IssueRow label="Competitor SEO comparison (top 3 local rivals)" blurred />
            <IssueRow label="Backlink health + toxic link check" blurred />
            <IssueRow label="Page speed score + Core Web Vitals" blurred />
            <IssueRow label="Schema markup / local business structured data" blurred />
            <IssueRow label="Google Business Profile completeness check" blurred />
            <IssueRow label="10 prioritized action items (quickest wins first)" blurred />
            <IssueRow label="Meta description quality + length" blurred />
            <IssueRow label="Mobile-friendliness assessment" blurred />
          </div>

          {/* Upsell card */}
          <div
            style={{
              background: "linear-gradient(135deg, #0369a1, #0284c7)",
              borderRadius: 12,
              padding: "24px 24px",
              color: "#fff",
              textAlign: "center",
              marginBottom: 24,
            }}
          >
            <p style={{ margin: "0 0 4px", fontSize: 12, opacity: 0.8, letterSpacing: "1px", textTransform: "uppercase" }}>
              One-time · No subscription
            </p>
            <p style={{ margin: "0 0 8px", fontSize: 28, fontWeight: 900 }}>$49</p>
            <h2 style={{ margin: "0 0 12px", fontSize: 18, fontWeight: 800 }}>
              Get the Complete Audit
            </h2>
            <p
              style={{
                margin: "0 0 20px",
                fontSize: 14,
                opacity: 0.9,
                lineHeight: 1.6,
              }}
            >
              All 12 findings + keyword gaps + competitor snapshot + 10 action items. Delivered to your inbox within minutes of payment.
            </p>
            {error && (
              <p style={{ color: "#fca5a5", fontSize: 13, margin: "0 0 12px" }}>{error}</p>
            )}
            <button
              onClick={startCheckout}
              disabled={checkoutLoading}
              style={{
                background: "#fff",
                color: "#0369a1",
                border: "none",
                padding: "14px 32px",
                borderRadius: 8,
                fontWeight: 800,
                fontSize: 15,
                cursor: checkoutLoading ? "not-allowed" : "pointer",
                opacity: checkoutLoading ? 0.7 : 1,
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {checkoutLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Redirecting…
                </>
              ) : (
                "Unlock Full Report for $49 →"
              )}
            </button>
            <p style={{ margin: "12px 0 0", fontSize: 11, opacity: 0.7 }}>
              Secure checkout via Stripe · Instant delivery
            </p>
          </div>

          {/* Start over link */}
          <div style={{ textAlign: "center" }}>
            <button
              onClick={() => {
                setPageState("idle");
                setResult(null);
                setError(null);
              }}
              style={{
                background: "none",
                border: "none",
                color: "#6b7280",
                fontSize: 13,
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Scan a different URL
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── IDLE / LOADING STATE ──────────────────────────────────────────────────
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 16px",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      <div style={{ maxWidth: 520, width: "100%", textAlign: "center" }}>
        {/* Badge */}
        <div
          style={{
            display: "inline-block",
            background: "#1e3a5f",
            border: "1px solid #3b82f6",
            borderRadius: 20,
            padding: "4px 16px",
            fontSize: 12,
            color: "#93c5fd",
            fontWeight: 700,
            letterSpacing: "1px",
            textTransform: "uppercase",
            marginBottom: 20,
          }}
        >
          Free · Instant · No signup required
        </div>

        {/* Headline */}
        <h1
          style={{
            fontSize: 36,
            fontWeight: 900,
            color: "#fff",
            lineHeight: 1.15,
            margin: "0 0 12px",
          }}
        >
          Get Your Free SEO Score
        </h1>
        <p
          style={{
            fontSize: 16,
            color: "#94a3b8",
            lineHeight: 1.7,
            margin: "0 0 32px",
          }}
        >
          Enter your website URL and we'll instantly check your on-page SEO health, title tags, headings, and more. Free teaser + optional $49 full report.
        </p>

        {/* Form card */}
        <div
          style={{
            background: "#fff",
            borderRadius: 16,
            padding: "28px 24px",
            boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
          }}
        >
          {pageState === "loading" ? (
            <div style={{ padding: "20px 0", textAlign: "center" }}>
              <Loader2
                size={40}
                color="#0369a1"
                style={{ animation: "spin 1s linear infinite", marginBottom: 12 }}
              />
              <p style={{ color: "#374151", fontWeight: 600, margin: 0 }}>
                Scanning your website…
              </p>
              <p style={{ color: "#9ca3af", fontSize: 13, margin: "4px 0 0" }}>
                This usually takes 5–10 seconds
              </p>
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            </div>
          ) : (
            <form onSubmit={runFreeScan}>
              <div style={{ marginBottom: 14 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#374151",
                    marginBottom: 6,
                    textAlign: "left",
                  }}
                >
                  Website URL
                </label>
                <div style={{ position: "relative" }}>
                  <Search
                    size={16}
                    color="#9ca3af"
                    style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)" }}
                  />
                  <input
                    type="text"
                    placeholder="yourwebsite.com"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      boxSizing: "border-box",
                      padding: "10px 12px 10px 36px",
                      border: "1.5px solid #d1d5db",
                      borderRadius: 8,
                      fontSize: 14,
                      outline: "none",
                    }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#374151",
                    marginBottom: 6,
                    textAlign: "left",
                  }}
                >
                  Your email (to receive the report)
                </label>
                <input
                  type="email"
                  placeholder="you@yourbusiness.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    padding: "10px 12px",
                    border: "1.5px solid #d1d5db",
                    borderRadius: 8,
                    fontSize: 14,
                    outline: "none",
                  }}
                />
              </div>

              {error && (
                <p
                  style={{
                    color: "#dc2626",
                    fontSize: 13,
                    margin: "-8px 0 16px",
                    textAlign: "left",
                  }}
                >
                  {error}
                </p>
              )}

              <button
                type="submit"
                style={{
                  width: "100%",
                  background: "#0369a1",
                  color: "#fff",
                  border: "none",
                  padding: "13px",
                  borderRadius: 8,
                  fontWeight: 800,
                  fontSize: 15,
                  cursor: "pointer",
                  letterSpacing: "0.2px",
                }}
              >
                Run Free Scan →
              </button>

              <p style={{ fontSize: 11, color: "#9ca3af", margin: "12px 0 0" }}>
                No account needed. Powered by Detroit Web Agency.
              </p>
            </form>
          )}
        </div>

        {/* Trust signals */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            gap: 24,
            marginTop: 24,
            flexWrap: "wrap",
          }}
        >
          {["Instant results", "No spam", "$49 full report optional"].map((item) => (
            <span
              key={item}
              style={{ fontSize: 12, color: "#64748b", display: "flex", alignItems: "center", gap: 4 }}
            >
              <CheckCircle size={12} color="#22c55e" />
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Branded fallback shown when an SMS/QR/email link is expired,
// invalid, or the underlying lead has already been claimed.
// Replaces blank white screens and bare 404s for our entry points.

import { Link } from "react-router-dom";

export type LinkExpiredVariant =
  | "claimed"
  | "expired"
  | "invalid"
  | "not_found"
  | "missing_params";

interface Props {
  variant?: LinkExpiredVariant;
  headline?: string;
  message?: string;
  primaryHref?: string;
  primaryLabel?: string;
}

const COPY: Record<LinkExpiredVariant, { icon: string; headline: string; message: string }> = {
  claimed: {
    icon: "😔",
    headline: "Lead already claimed",
    message:
      "Beat to it this time. The next job in your area goes to the contractor who taps fastest — keep your phone close.",
  },
  expired: {
    icon: "⌛",
    headline: "This link has expired",
    message:
      "Leads move fast. Check your most recent text from us for a fresh link, or browse what's open right now.",
  },
  invalid: {
    icon: "⚠️",
    headline: "Invalid link",
    message:
      "This link is missing some information. Open the original text message and tap the link directly — copy/paste sometimes drops characters.",
  },
  not_found: {
    icon: "🔍",
    headline: "Lead not found",
    message:
      "This lead may have been removed or the link is incorrect. Browse what's open right now or text Matt and we'll track it down.",
  },
  missing_params: {
    icon: "⚠️",
    headline: "Invalid link",
    message:
      "This link is missing required information. Please use the link from your text message.",
  },
};

export default function LinkExpired({
  variant = "expired",
  headline,
  message,
  primaryHref = "/marketplace",
  primaryLabel = "View Current Marketplace",
}: Props) {
  const copy = COPY[variant];
  return (
    <div
      style={{
        minHeight: "100dvh",
        background: "#0a1628",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "clamp(24px, 6vw, 40px)",
      }}
    >
      <div style={{ maxWidth: 480, width: "100%", textAlign: "center" }}>
        <div style={{ fontSize: 56, marginBottom: 16 }}>{copy.icon}</div>
        <h1
          style={{
            color: "#fff",
            fontSize: "clamp(22px, 6vw, 28px)",
            fontWeight: 800,
            margin: "0 0 12px",
            lineHeight: 1.25,
          }}
        >
          {headline ?? copy.headline}
        </h1>
        <p
          style={{
            color: "#94a3b8",
            fontSize: 16,
            lineHeight: 1.7,
            margin: "0 0 28px",
            overflowWrap: "anywhere",
          }}
        >
          {message ?? copy.message}
        </p>

        <div style={{ display: "grid", gap: 12 }}>
          <Link
            to={primaryHref}
            style={{
              display: "inline-block",
              background: "#00d4ff",
              color: "#0a1628",
              padding: "16px 20px",
              minHeight: 52,
              borderRadius: 8,
              fontSize: 16,
              fontWeight: 800,
              textDecoration: "none",
              touchAction: "manipulation",
            }}
          >
            {primaryLabel}
          </Link>
          <a
            href="sms:+13139921219"
            style={{
              display: "inline-block",
              background: "transparent",
              color: "#00d4ff",
              padding: "14px 20px",
              minHeight: 48,
              border: "1px solid #1e3a5f",
              borderRadius: 8,
              fontSize: 15,
              fontWeight: 700,
              textDecoration: "none",
              touchAction: "manipulation",
            }}
          >
            Text Matt at (313) 992-1219
          </a>
        </div>
      </div>
    </div>
  );
}

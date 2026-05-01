import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";

const BG = "#0a1628";
const ACCENT = "#00d4ff";

const MISSING_IN_EWAY = [
  {
    title: "Auto-SMS on tech arrival + departure",
    body: "Customers get a text the moment your tech is en route, and another when the job's done. eWay lives in Outlook — the office sees the email, the customer never knows.",
  },
  {
    title: "Automated Google review requests",
    body: "Two hours after job completion, the customer gets a one-tap review link. Trades shops using this go from 12 reviews/year to 12/month.",
  },
  {
    title: "Missed-call text-back (under 60 seconds)",
    body: "Every missed call gets an instant SMS: \"Sorry we missed you — Pat from D.J. Conley here. What can we help with?\" Recovers ~38% of leads competitors lose.",
  },
  {
    title: "Predictive Sales fusion alerts",
    body: "When Stellantis visits your boiler-tune-up page AND has an active RFP on MITN.info, you get one SMS with both signals. eWay can't see your website. We see both.",
  },
  {
    title: "SiteRadar visitor intelligence",
    body: "Identify the company behind every website visitor instantly. Surface the most likely decision-maker. Get an SMS when a hot account returns. eWay has zero web visibility.",
  },
];

export default function MarketingLayerForEway() {
  return (
    <div
      style={{
        background: BG,
        minHeight: "100vh",
        color: "#e2e8f0",
        fontFamily:
          "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <SEOHead
        title="Keep eWay. Add the Layer It Doesn't Have. | Detroit Web Agency"
        description="If your office runs on eWay CRM, don't rip it out. Bolt our Marketing Layer on top: customer SMS, review automation, missed-call text-back, Predictive Sales alerts, and SiteRadar visitor intelligence."
      />

      <header style={{ maxWidth: 880, margin: "0 auto", padding: "60px 24px 24px" }}>
        <p
          style={{
            color: ACCENT,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 2,
            textTransform: "uppercase",
            margin: "0 0 12px",
          }}
        >
          For shops already using eWay CRM
        </p>
        <h1
          style={{
            fontSize: 44,
            fontWeight: 900,
            lineHeight: 1.15,
            margin: "0 0 18px",
          }}
        >
          Keep eWay.{" "}
          <span style={{ color: ACCENT }}>
            Add the layer it doesn't have.
          </span>
        </h1>
        <p
          style={{
            color: "#94a3b8",
            fontSize: 17,
            lineHeight: 1.7,
            margin: 0,
          }}
        >
          eWay CRM is solid for office-based contact + project management inside Outlook.
          But it doesn't text customers, doesn't request reviews, doesn't see your website,
          and can't catch missed calls. We don't replace eWay — we run alongside it.
          One flat fee, your team keeps the workflow they already know.
        </p>
      </header>

      <section style={{ maxWidth: 880, margin: "0 auto", padding: "16px 24px 32px" }}>
        <div
          style={{
            background: "#0d1f3c",
            border: `1px solid ${ACCENT}30`,
            borderRadius: 14,
            padding: "28px 32px",
          }}
        >
          <p
            style={{
              color: ACCENT,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: 2,
              textTransform: "uppercase",
              margin: "0 0 6px",
            }}
          >
            The Marketing Layer
          </p>
          <p style={{ fontSize: 22, fontWeight: 800, margin: "0 0 8px", color: "#fff" }}>
            $149/mo · runs on top of eWay · zero workflow change for your office
          </p>
          <p style={{ color: "#94a3b8", fontSize: 14, margin: 0 }}>
            We pull job + customer data via webhook or weekly export. eWay stays the
            system of record. We add the customer-facing automation layer on top.
          </p>
        </div>
      </section>

      <section style={{ maxWidth: 880, margin: "0 auto", padding: "16px 24px 48px" }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, color: "#fff", margin: "0 0 16px" }}>
          The 5 things eWay doesn't do
        </h2>
        <div style={{ display: "grid", gap: 14 }}>
          {MISSING_IN_EWAY.map((item, i) => (
            <div
              key={i}
              style={{
                background: "#0d1f3c",
                border: "1px solid #1e3a5f",
                borderRadius: 12,
                padding: "20px 22px",
              }}
            >
              <div style={{ display: "flex", gap: 14, alignItems: "baseline" }}>
                <span style={{ color: ACCENT, fontWeight: 800, fontSize: 14 }}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 style={{ fontSize: 16, fontWeight: 800, color: "#fff", margin: "0 0 6px" }}>
                    {item.title}
                  </h3>
                  <p style={{ color: "#94a3b8", fontSize: 14, lineHeight: 1.65, margin: 0 }}>
                    {item.body}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section style={{ maxWidth: 880, margin: "0 auto", padding: "0 24px 80px" }}>
        <div
          style={{
            background: `linear-gradient(135deg, ${ACCENT}15, transparent)`,
            border: `1px solid ${ACCENT}40`,
            borderRadius: 14,
            padding: "32px 32px 36px",
            textAlign: "center",
          }}
        >
          <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 16px" }}>
            Want to consolidate later? When you're ready, we have a clean migration
            path off eWay onto FieldDesk — at your pace, with a dual-run period so
            nothing breaks.
          </p>
          <Link
            to="/fielddesk-migration"
            style={{
              color: ACCENT,
              fontWeight: 700,
              fontSize: 14,
              textDecoration: "none",
              borderBottom: `1px solid ${ACCENT}`,
              paddingBottom: 2,
              marginRight: 24,
            }}
          >
            See the FieldDesk migration path →
          </Link>
          <Link
            to="/contact"
            style={{
              display: "inline-block",
              background: ACCENT,
              color: "#0a1628",
              fontWeight: 800,
              fontSize: 15,
              padding: "12px 28px",
              borderRadius: 8,
              textDecoration: "none",
              marginTop: 16,
            }}
          >
            Add the Marketing Layer — $149/mo
          </Link>
        </div>
      </section>
    </div>
  );
}

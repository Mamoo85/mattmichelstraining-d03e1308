import { Helmet } from "react-helmet-async";
import { CheckCircle, ExternalLink, Phone } from "lucide-react";

export default function BlueprintSuccess() {
  return (
    <>
      <Helmet>
        <title>Blueprint Unlocked — Detroit Web Agency</title>
        <meta name="robots" content="noindex" />
      </Helmet>

      <div style={{ background: "#0a1628", minHeight: "100vh", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
        <div style={{ maxWidth: "520px", width: "100%", textAlign: "center" }}>

          {/* ICON */}
          <div style={{ width: "72px", height: "72px", background: "rgba(0,212,255,0.1)", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 28px" }}>
            <CheckCircle size={36} color="#00d4ff" />
          </div>

          {/* HEADLINE */}
          <h1 style={{ color: "#fff", fontSize: "28px", fontWeight: 900, marginBottom: "12px", letterSpacing: "-0.01em" }}>
            Your Blueprint is on the way
          </h1>
          <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "16px", lineHeight: 1.6, marginBottom: "36px" }}>
            Check your inbox — the delivery email arrives within 2 minutes. It includes a direct link to your Blueprint and instructions for printing to PDF.
          </p>

          {/* BLUEPRINT LINK */}
          <a
            href="/blueprint/index.html"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              width: "100%",
              padding: "16px",
              borderRadius: "10px",
              background: "#00d4ff",
              color: "#0a1628",
              fontSize: "15px",
              fontWeight: 900,
              textDecoration: "none",
              marginBottom: "16px",
              boxSizing: "border-box",
            }}
          >
            <ExternalLink size={16} />
            Open Blueprint Now →
          </a>

          {/* CALL CTA */}
          <a
            href="tel:+13139921219"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              width: "100%",
              padding: "16px",
              borderRadius: "10px",
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "rgba(255,255,255,0.7)",
              fontSize: "15px",
              fontWeight: 600,
              textDecoration: "none",
              boxSizing: "border-box",
            }}
          >
            <Phone size={16} />
            Book a free 15-min call — (313) 992-1219
          </a>

          <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "12px", marginTop: "28px", lineHeight: 1.6 }}>
            Detroit Web Agency · Grosse Pointe, MI<br />
            Contractor websites from $499 · No contracts
          </p>

        </div>
      </div>
    </>
  );
}

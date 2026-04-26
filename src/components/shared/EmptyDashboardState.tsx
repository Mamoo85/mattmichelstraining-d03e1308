import { Sparkles, ExternalLink } from "lucide-react";

type Props = {
  productName: string;
  checklist: string[];
  etaText: string;
  setupGuideHref?: string;
};

export default function EmptyDashboardState({ productName, checklist, etaText, setupGuideHref }: Props) {
  return (
    <div
      style={{
        background: "linear-gradient(135deg, #0a1628 0%, #0d1f3c 100%)",
        border: "1px solid #1e3a5f",
        borderRadius: 16,
        padding: 32,
        textAlign: "center",
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: "50%",
          background: "rgba(0,212,255,0.1)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Sparkles className="h-8 w-8" style={{ color: "#00d4ff" }} />
      </div>
      <h3 style={{ color: "#fff", fontSize: 20, margin: "0 0 8px", fontWeight: 700 }}>
        {productName} is warming up
      </h3>
      <p style={{ color: "#94a3b8", fontSize: 14, margin: "0 0 24px" }}>{etaText}</p>

      <div
        style={{
          textAlign: "left",
          background: "rgba(0,0,0,0.2)",
          borderRadius: 10,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <p
          style={{
            color: "#00d4ff",
            fontSize: 11,
            fontWeight: 800,
            letterSpacing: 2,
            textTransform: "uppercase",
            margin: "0 0 12px",
          }}
        >
          What's happening
        </p>
        <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 10 }}>
          {checklist.map((item, i) => (
            <li key={i} style={{ color: "#e2e8f0", fontSize: 14, display: "flex", gap: 10 }}>
              <span style={{ color: "#00d4ff" }}>→</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {setupGuideHref && (
        <a
          href={setupGuideHref}
          target="_blank"
          rel="noreferrer"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            color: "#00d4ff",
            fontSize: 13,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Setup guide <ExternalLink className="h-3.5 w-3.5" />
        </a>
      )}
    </div>
  );
}

import dwaLogo from "@/assets/dwa-logo-clean.png";
import type { LeadDetail } from "./LeadDetailDrawer";

interface Props {
  lead: LeadDetail;
}

// Print-only A4 dossier. Hidden on screen via Tailwind `hidden`,
// revealed by `@media print` in src/index.css (.dossier-print rule).
export default function DossierPrintSheet({ lead }: Props) {
  const generated = new Date().toLocaleDateString(undefined, {
    year: "numeric", month: "long", day: "numeric",
  });
  const conf = typeof lead.confidence === "number" ? `${lead.confidence}/10` : "—";

  return (
    <div className="dossier-print hidden">
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #0a1628", paddingBottom: "12pt", marginBottom: "18pt" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12pt" }}>
          <img src={dwaLogo} alt="Detroit Web Agency" style={{ height: "36pt", width: "auto" }} />
          <div>
            <div style={{ fontSize: "10pt", letterSpacing: "0.18em", textTransform: "uppercase", color: "#475569" }}>
              Detroit Web Agency · Lead Dossier
            </div>
            <div style={{ fontSize: "9pt", color: "#64748b" }}>Generated {generated}</div>
          </div>
        </div>
        <div style={{ width: "80pt", height: "80pt", border: "1.5pt solid #0a1628", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "4pt" }}>
          <div style={{ fontSize: "7pt", color: "#475569", textAlign: "center", lineHeight: 1.2 }}>QR<br/>Scan to reopen</div>
        </div>
      </div>

      <h1 style={{ fontSize: "22pt", margin: "0 0 4pt 0", color: "#0a1628" }}>{lead.company_name}</h1>
      <div style={{ fontSize: "11pt", color: "#475569", marginBottom: "16pt" }}>
        {[lead.industry, lead.location].filter(Boolean).join(" · ")}
      </div>

      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16pt", fontSize: "10pt" }}>
        <tbody>
          <tr><td style={{ padding: "6pt 0", borderBottom: "1px solid #e2e8f0", width: "30%", color: "#475569" }}>Signal type</td><td style={{ padding: "6pt 0", borderBottom: "1px solid #e2e8f0" }}>{(lead.signal_type || "—").replace(/_/g, " ")}</td></tr>
          <tr><td style={{ padding: "6pt 0", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>Signal strength</td><td style={{ padding: "6pt 0", borderBottom: "1px solid #e2e8f0" }}>{conf}</td></tr>
          {lead.hiring_count ? <tr><td style={{ padding: "6pt 0", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>Hiring</td><td style={{ padding: "6pt 0", borderBottom: "1px solid #e2e8f0" }}>{lead.hiring_count}× {lead.hiring_roles?.join(", ") || "open roles"}</td></tr> : null}
          {lead.detected_at ? <tr><td style={{ padding: "6pt 0", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>Detected</td><td style={{ padding: "6pt 0", borderBottom: "1px solid #e2e8f0" }}>{new Date(lead.detected_at).toLocaleDateString()}</td></tr> : null}
        </tbody>
      </table>

      {lead.predicted_needs?.length ? (
        <div style={{ marginBottom: "16pt" }}>
          <div style={{ fontSize: "9pt", letterSpacing: "0.16em", textTransform: "uppercase", color: "#475569", marginBottom: "6pt" }}>Predicted needs</div>
          <div style={{ fontSize: "11pt" }}>{lead.predicted_needs.join(" · ")}</div>
        </div>
      ) : null}

      {lead.recommended_pitch ? (
        <div style={{ marginBottom: "16pt", paddingLeft: "10pt", borderLeft: "2pt solid #0a1628" }}>
          <div style={{ fontSize: "9pt", letterSpacing: "0.16em", textTransform: "uppercase", color: "#475569", marginBottom: "6pt" }}>Automated Intel</div>
          <div style={{ fontSize: "11pt", lineHeight: 1.5 }}>{lead.recommended_pitch}</div>
        </div>
      ) : null}

      {lead.source_urls?.length ? (
        <div style={{ marginBottom: "16pt" }}>
          <div style={{ fontSize: "9pt", letterSpacing: "0.16em", textTransform: "uppercase", color: "#475569", marginBottom: "6pt" }}>Source citations</div>
          <ol style={{ fontSize: "9pt", paddingLeft: "16pt", lineHeight: 1.6, wordBreak: "break-all" }}>
            {lead.source_urls.map((u, i) => <li key={i}>{u}</li>)}
          </ol>
        </div>
      ) : null}

      <div style={{ position: "fixed", bottom: "1cm", left: "1cm", right: "1cm", fontSize: "8pt", color: "#94a3b8", borderTop: "1px solid #e2e8f0", paddingTop: "6pt", display: "flex", justifyContent: "space-between" }}>
        <span>detroitwebagent.com · Proprietary &amp; confidential</span>
        <span>Lead ID {lead.id.slice(0, 8)}</span>
      </div>
    </div>
  );
}

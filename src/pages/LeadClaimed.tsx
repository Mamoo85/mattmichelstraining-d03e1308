// /lead-claimed
// Shown when a contractor tries to buy a lead that's already been sold.

export default function LeadClaimed() {
  return (
    <div style={{ minHeight: "100vh", background: "#0a1628", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 24px" }}>
      <div style={{ maxWidth: 480, textAlign: "center" }}>
        <div style={{ fontSize: 64, marginBottom: 20 }}>😔</div>
        <h1 style={{ color: "#fff", fontSize: 30, fontWeight: 800, margin: "0 0 12px" }}>
          Lead Already Claimed
        </h1>
        <p style={{ color: "#94a3b8", fontSize: 16, lineHeight: 1.8, margin: "0 0 32px" }}>
          Another contractor got there first. These leads move fast — that's the point.
        </p>
        <p style={{ color: "#64748b", fontSize: 15, margin: "0 0 32px" }}>
          We'll text you the next exclusive lead as soon as it drops.
        </p>
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <a
            href="sms:+13139921219"
            style={{
              background: "#00d4ff", color: "#0a1628", padding: "13px 28px",
              borderRadius: 8, fontWeight: 800, fontSize: 15, textDecoration: "none",
            }}
          >
            Text Matt to Stay in Line
          </a>
          <a
            href="/contractor-leads"
            style={{
              background: "transparent", color: "#94a3b8", padding: "13px 28px",
              borderRadius: 8, fontWeight: 700, fontSize: 15, textDecoration: "none",
              border: "1px solid #1e3a5f",
            }}
          >
            Back to Leads
          </a>
        </div>
      </div>
    </div>
  );
}

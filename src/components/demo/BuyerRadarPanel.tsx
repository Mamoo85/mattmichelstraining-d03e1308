/**
 * Buyer Radar / Demand Radar teaser panel for the demo.
 * Shows upcoming RFPs and bid opportunities scraped from MITN, BidNet, SAM.gov.
 */
export default function BuyerRadarPanel({ city = "Troy", buyerRadarValue }: { city?: string; buyerRadarValue?: string }) {
  const RFPS = [
    {
      org: "Stellantis Warren Truck Plant",
      title: "Multi-unit Boiler Retrofit & Service Contract",
      value: "$2.4M",
      due: "Bids due Aug 14",
      source: "MITN.info",
      hot: true,
    },
    {
      org: "Wayne County RESA",
      title: "K-12 HVAC + Boiler Maintenance — 4 districts",
      value: "$840k",
      due: "Bids due Aug 22",
      source: "BidNet",
      hot: false,
    },
    {
      org: "Detroit Medical Center",
      title: "Annual Service Contract — Steam Plant",
      value: "$310k/yr",
      due: "RFP issued today",
      source: "SAM.gov",
      hot: true,
    },
  ];

  return (
    <div
      style={{
        background: "#0a1628",
        border: "1px solid #8b5cf640",
        borderRadius: 16,
        padding: "22px 24px",
        marginBottom: 20,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: "#a78bfa", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            🎯 Buyer Radar — $199/mo
          </p>
          <p style={{ margin: "4px 0 0", fontWeight: 800, fontSize: 16, color: "#fff" }}>
            RFPs near {city} — texted to Pat the minute they post
          </p>
        </div>
        <span
          style={{
            background: "#8b5cf615",
            border: "1px solid #8b5cf640",
            color: "#a78bfa",
            borderRadius: 20,
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 700,
          }}
        >
          3 LIVE
        </span>
      </div>

      <p style={{ margin: "0 0 14px", fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
        We watch <strong style={{ color: "#fff" }}>MITN.info, BidNet, SAM.gov, MITA, and 6 county procurement boards</strong> 24/7. The day a boiler retrofit RFP drops in your zip — you're the first call we make.
      </p>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {RFPS.map((r) => (
          <div
            key={r.title}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              background: "#060e1a",
              borderRadius: 10,
              padding: "12px 14px",
              border: r.hot ? "1px solid #dc262640" : "1px solid #1e3a5f",
              gap: 12,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                {r.hot && (
                  <span style={{ fontSize: 9, background: "#dc2626", color: "#fff", padding: "2px 6px", borderRadius: 6, fontWeight: 800, letterSpacing: "0.1em" }}>
                    🔥 HOT
                  </span>
                )}
                <p style={{ margin: 0, fontSize: 12, color: "#a78bfa", fontWeight: 700 }}>{r.org}</p>
              </div>
              <p style={{ margin: 0, fontSize: 13, color: "#fff", fontWeight: 600, lineHeight: 1.3 }}>{r.title}</p>
              <p style={{ margin: "3px 0 0", fontSize: 10, color: "#64748b" }}>
                via {r.source} · {r.due}
              </p>
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 900, color: "#10b981" }}>{r.value}</p>
              <p style={{ margin: 0, fontSize: 9, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase", fontWeight: 700 }}>
                Estimated
              </p>
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          marginTop: 14,
          background: "#060e1a",
          borderRadius: 12,
          padding: "12px 16px",
          border: "1px solid #8b5cf620",
        }}
      >
        <p style={{ margin: "0 0 4px", fontSize: 11, color: "#a78bfa", fontWeight: 700 }}>💡 Why Pat needs this:</p>
        <p style={{ margin: 0, fontSize: 12, color: "#94a3b8", lineHeight: 1.6 }}>
          {buyerRadarValue ||
            "Most contractors find these RFPs the day they're due. We text them to you the minute they post — usually 2-4 weeks before your competitors notice."}
        </p>
      </div>
    </div>
  );
}

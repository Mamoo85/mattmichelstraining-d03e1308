import { useEffect, useState } from "react";

/**
 * Reusable panel — After-Hours Missed-Call Catch.
 * Animated phone mockup: incoming missed call at 2:34 AM, then 30s later an outbound auto-text bubble slides in.
 */
export default function MissedCallPanel({
  responseTime = "< 60 sec",
  coverage = "24/7/365",
  recoveryRate = "~38% convert",
}: {
  responseTime?: string;
  coverage?: string;
  recoveryRate?: string;
}) {
  const [showReply, setShowReply] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setShowReply(true), 900);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        background: "#0a1628",
        border: "1px solid #dc262640",
        borderRadius: 16,
        padding: "22px 24px",
        marginBottom: 20,
        boxShadow: "0 0 60px #dc262610",
      }}
    >
      <style>{`
        @keyframes mcPulse { 0%,100% { box-shadow: 0 0 0 0 #dc262660 } 50% { box-shadow: 0 0 0 12px transparent } }
        @keyframes mcSlideUp { from { transform: translateY(20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        @keyframes mcGlow { 0%,100% { box-shadow: 0 0 14px #00d4ff60 } 50% { box-shadow: 0 0 28px #00d4ff90 } }
      `}</style>

      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16, flexWrap: "wrap", gap: 8 }}>
        <div>
          <p style={{ margin: 0, fontSize: 11, color: "#dc2626", fontWeight: 800, letterSpacing: "0.15em", textTransform: "uppercase" }}>
            🚨 After-Hours Emergency Lead Capture
          </p>
          <p style={{ margin: "4px 0 0", fontWeight: 800, fontSize: 16, color: "#fff" }}>
            Missed-Call Catch — $99/mo
          </p>
        </div>
        <span
          style={{
            background: "#dc262615",
            border: "1px solid #dc262640",
            color: "#dc2626",
            borderRadius: 20,
            padding: "3px 10px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.1em",
          }}
        >
          LIVE 24/7
        </span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "minmax(240px, 280px) 1fr", gap: 24, alignItems: "start" }}>
        {/* Phone mockup */}
        <div
          style={{
            background: "linear-gradient(180deg, #060e1a, #0a1628)",
            border: "8px solid #1e293b",
            borderRadius: 36,
            padding: "16px 14px 22px",
            position: "relative",
            boxShadow: "0 20px 50px rgba(0,0,0,0.6)",
          }}
        >
          {/* Notch */}
          <div
            style={{
              position: "absolute",
              top: 8,
              left: "50%",
              transform: "translateX(-50%)",
              width: 80,
              height: 18,
              background: "#000",
              borderRadius: 12,
            }}
          />
          {/* Status bar */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              padding: "20px 8px 12px",
              fontSize: 11,
              color: "#94a3b8",
              fontWeight: 700,
            }}
          >
            <span style={{ fontVariantNumeric: "tabular-nums" }}>2:34 AM</span>
            <span>📶 🔋</span>
          </div>

          {/* App header */}
          <div style={{ padding: "6px 8px 12px", borderBottom: "1px solid #1e293b" }}>
            <p style={{ margin: 0, fontSize: 10, color: "#64748b", letterSpacing: "0.1em", textTransform: "uppercase" }}>Messages</p>
            <p style={{ margin: "2px 0 0", fontSize: 13, color: "#fff", fontWeight: 700 }}>(586) 555-0142</p>
            <p style={{ margin: "1px 0 0", fontSize: 10, color: "#64748b" }}>Plant manager · Stellantis Warren</p>
          </div>

          {/* Bubbles */}
          <div style={{ padding: "12px 4px", display: "flex", flexDirection: "column", gap: 10 }}>
            {/* Incoming missed call */}
            <div
              style={{
                alignSelf: "flex-start",
                maxWidth: "85%",
                background: "#1e293b",
                color: "#cbd5e1",
                padding: "10px 14px",
                borderRadius: "16px 16px 16px 4px",
                fontSize: 11,
                fontWeight: 600,
                animation: "mcPulse 2s ease-in-out 2",
                lineHeight: 1.4,
              }}
            >
              <p style={{ margin: 0, color: "#dc2626", fontSize: 10, fontWeight: 800, letterSpacing: "0.05em" }}>📞 MISSED CALL</p>
              <p style={{ margin: "3px 0 0", color: "#fff" }}>(586) 555-0142</p>
              <p style={{ margin: "2px 0 0", fontSize: 10, color: "#64748b" }}>Voicemail · 2:34 AM</p>
            </div>

            {/* Auto-text reply */}
            {showReply && (
              <div
                style={{
                  alignSelf: "flex-end",
                  maxWidth: "90%",
                  background: "linear-gradient(135deg, #00d4ff, #0891b2)",
                  color: "#001520",
                  padding: "10px 14px",
                  borderRadius: "16px 16px 4px 16px",
                  fontSize: 11.5,
                  fontWeight: 600,
                  lineHeight: 1.4,
                  animation: "mcSlideUp 400ms ease-out, mcGlow 2.4s ease-in-out infinite",
                }}
              >
                Got your voicemail! Our emergency boiler team will call back within 15 min. —D.J. Conley
                <p style={{ margin: "6px 0 0", fontSize: 9, color: "#001520", opacity: 0.7, fontWeight: 700, letterSpacing: "0.05em" }}>
                  DELIVERED · 2:34 AM · 0.4s
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Right: copy */}
        <div>
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 15,
              color: "#fff",
              fontWeight: 700,
              lineHeight: 1.5,
            }}
          >
            Every missed emergency call is a competitor's gain.
          </p>
          <p style={{ margin: "0 0 16px", fontSize: 13, color: "#94a3b8", lineHeight: 1.7 }}>
            Missed-Call Catch fires an auto-text in under 60 seconds, 24/7 — even at 2 AM on a Sunday. The customer feels acknowledged.
            They wait. They stay yours.
          </p>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
            {[
              { label: "Avg response", value: responseTime, color: "#00d4ff" },
              { label: "Coverage", value: coverage, color: "#10b981" },
              { label: "Recovery rate", value: recoveryRate, color: "#f59e0b" },
            ].map((s) => (
              <div
                key={s.label}
                style={{
                  background: "#060e1a",
                  border: `1px solid ${s.color}30`,
                  borderRadius: 10,
                  padding: "10px 8px",
                  textAlign: "center",
                }}
              >
                <p style={{ margin: 0, fontSize: 14, fontWeight: 900, color: s.color }}>{s.value}</p>
                <p style={{ margin: "2px 0 0", fontSize: 10, color: "#64748b", letterSpacing: "0.05em" }}>{s.label}</p>
              </div>
            ))}
          </div>

          <p
            style={{
              margin: 0,
              fontSize: 11,
              color: "#475569",
              padding: "10px 14px",
              background: "#060e1a",
              borderRadius: 10,
              border: "1px solid #1e3a5f",
              lineHeight: 1.6,
            }}
          >
            <span style={{ color: "#00d4ff", fontWeight: 700 }}>+ $99/mo</span> · Pairs with FieldDesk · Uses your existing forwarding number · Voicemail-to-text included
          </p>
        </div>
      </div>
    </div>
  );
}

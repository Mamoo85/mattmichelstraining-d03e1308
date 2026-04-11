import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

interface ExecutionRecord {
  id: string;
  ts: string;
  fn: string;
  status: "running" | "ok" | "error";
  result?: unknown;
}

function ActionButton({ label, onClick, running }: { label: string; onClick: () => void; running: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={running}
      style={{
        background: running ? "#1e3a5f" : "#00d4ff",
        color: running ? "#64748b" : "#0a1628",
        border: "none", borderRadius: 6, padding: "9px 18px",
        fontSize: 13, fontWeight: 700, cursor: running ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
      }}
    >{running ? "Running…" : label}</button>
  );
}

function JsonBox({ data }: { data: unknown }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen(o => !o)} style={{ color: "#00d4ff", background: "none", border: "none", fontSize: 12, cursor: "pointer", padding: 0 }}>
        {open ? "▲ hide" : "▼ expand"}
      </button>
      {open && (
        <pre style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 6, padding: 12, fontSize: 11, color: "#94a3b8", overflowX: "auto", marginTop: 6, maxHeight: 300, overflowY: "auto" }}>
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AdminSimulationSuite() {
  const [log, setLog] = useState<ExecutionRecord[]>([]);
  const [running, setRunning] = useState<Record<string, boolean>>({});
  const [aiInput, setAiInput] = useState(`{"senderEmail":"test@hvac.com","replyBody":"Maybe, what's the cost?","originalSubject":"Hiring HVAC techs in Detroit?"}`);
  const [auditUrl, setAuditUrl] = useState("https://");
  const [auditResult, setAuditResult] = useState<string | null>(null);
  const [visionFile, setVisionFile] = useState<File | null>(null);
  const [visionResult, setVisionResult] = useState<unknown>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const run = async (fnName: string, body?: unknown) => {
    const id = crypto.randomUUID();
    setRunning(r => ({ ...r, [fnName]: true }));
    const entry: ExecutionRecord = { id, ts: new Date().toLocaleTimeString(), fn: fnName, status: "running" };
    setLog(l => [entry, ...l]);

    try {
      const { data, error } = await supabase.functions.invoke(fnName, body ? { body } : undefined);
      const result = error ? { error: error.message } : data;
      setLog(l => l.map(e => e.id === id ? { ...e, status: error ? "error" : "ok", result } : e));
    } catch (e) {
      setLog(l => l.map(e2 => e2.id === id ? { ...e2, status: "error", result: { error: String(e) } } : e2));
    } finally {
      setRunning(r => ({ ...r, [fnName]: false }));
    }
  };

  const runVision = async () => {
    if (!visionFile) return;
    setRunning(r => ({ ...r, "test-license-vision": true }));
    setVisionResult(null);
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        const base64 = dataUrl.split(",")[1];
        const mime_type = visionFile.type;
        const { data, error } = await supabase.functions.invoke("test-license-vision", {
          body: { image_base64: base64, mime_type },
        });
        setVisionResult(error ? { error: error.message } : data);
        setRunning(r => ({ ...r, "test-license-vision": false }));
      };
      reader.readAsDataURL(visionFile);
    } catch (e) {
      setVisionResult({ error: String(e) });
      setRunning(r => ({ ...r, "test-license-vision": false }));
    }
  };

  const runAudit = async () => {
    setRunning(r => ({ ...r, "generate-digital-audit": true }));
    setAuditResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-digital-audit", {
        body: { url: auditUrl },
      });
      setAuditResult(error ? `Error: ${error.message}` : data?.pitch_sms || JSON.stringify(data));
    } finally {
      setRunning(r => ({ ...r, "generate-digital-audit": false }));
    }
  };

  const statusColor = (s: ExecutionRecord["status"]) =>
    s === "ok" ? "#22c55e" : s === "error" ? "#ef4444" : "#f59e0b";

  return (
    <div style={{ padding: "28px 0", color: "#e2e8f0" }}>
      <p style={{ color: "#00d4ff", fontSize: 11, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", margin: "0 0 6px" }}>
        ADMIN TOOLS
      </p>
      <h2 style={{ color: "#fff", fontSize: 22, fontWeight: 800, margin: "0 0 28px" }}>Simulation Suite</h2>

      {/* Section A — Cron Triggers */}
      <div style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 10, padding: "22px 24px", marginBottom: 20 }}>
        <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", margin: "0 0 16px" }}>
          CRON TRIGGERS
        </p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginBottom: 20 }}>
          <ActionButton label="Invoke Scanner" onClick={() => run("hire-alert-scanner")} running={!!running["hire-alert-scanner"]} />
          <ActionButton label="Run Trial Conversions" onClick={() => run("hire-alert-trial-convert")} running={!!running["hire-alert-trial-convert"]} />
          <ActionButton label="Run Phantom Alerts" onClick={() => run("hire-alert-phantom-alert")} running={!!running["hire-alert-phantom-alert"]} />
          <ActionButton label="Release Pending Replies" onClick={() => run("release-pending-replies")} running={!!running["release-pending-replies"]} />
          <ActionButton label="Check License Expirations" onClick={() => run("license-expiry-checker")} running={!!running["license-expiry-checker"]} />
          <ActionButton label="Run Aged Lead Downsell" onClick={() => run("contractor-aged-lead-downsell")} running={!!running["contractor-aged-lead-downsell"]} />
        </div>

        {/* AI Classifier */}
        <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", margin: "0 0 8px" }}>TEST AI CLASSIFIER</p>
        <textarea
          value={aiInput}
          onChange={e => setAiInput(e.target.value)}
          rows={3}
          style={{ width: "100%", background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 6, padding: "10px 12px", color: "#e2e8f0", fontSize: 12, fontFamily: "monospace", boxSizing: "border-box", resize: "vertical" }}
        />
        <button
          onClick={() => { try { run("ai-reply-detector", JSON.parse(aiInput)); } catch { alert("Invalid JSON"); } }}
          disabled={!!running["ai-reply-detector"]}
          style={{ marginTop: 8, background: !!running["ai-reply-detector"] ? "#1e3a5f" : "#0f2342", color: "#00d4ff", border: "1px solid #00d4ff", borderRadius: 6, padding: "8px 16px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
        >{running["ai-reply-detector"] ? "Running…" : "Classify Reply"}</button>
      </div>

      {/* Section B — Pipe Tests */}
      <div style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 10, padding: "22px 24px", marginBottom: 20 }}>
        <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", margin: "0 0 16px" }}>
          PIPE TESTS
        </p>

        <div style={{ display: "grid", gap: 24 }}>
          {/* PPL Lead Notify */}
          <div>
            <p style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700, margin: "0 0 6px" }}>PPL Lead Notify</p>
            <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 10px" }}>Sends test SMS to admin phone via contractor-lead-notify with a mock lead payload.</p>
            <ActionButton
              label="Send Test Lead SMS"
              onClick={() => run("contractor-lead-notify", { lead_id: "test-sim-001", trade: "HVAC", city: "Detroit", contact_name: "Test Lead", contact_phone: "+15551234567", _test: true })}
              running={!!running["contractor-lead-notify"]}
            />
          </div>

          {/* License Vision OCR */}
          <div>
            <p style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700, margin: "0 0 6px" }}>License Vision OCR</p>
            <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 10px" }}>Upload a license photo — Claude Vision extracts the data. No DB writes.</p>
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${visionFile ? "#00d4ff" : "#1e3a5f"}`,
                borderRadius: 8, padding: "20px 16px", textAlign: "center", cursor: "pointer",
                background: "#0a1628", marginBottom: 12,
              }}
            >
              {visionFile
                ? <span style={{ color: "#00d4ff", fontSize: 13, fontWeight: 600 }}>{visionFile.name}</span>
                : <span style={{ color: "#475569", fontSize: 13 }}>Click to upload license image (JPEG, PNG, WEBP · max 5MB)</span>
              }
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              style={{ display: "none" }}
              onChange={e => {
                const f = e.target.files?.[0];
                if (f && f.size <= 5 * 1024 * 1024) setVisionFile(f);
                else if (f) alert("File too large — max 5MB");
              }}
            />
            <ActionButton label="Analyze License Image" onClick={runVision} running={!!running["test-license-vision"]} />
            {visionResult && (
              <pre style={{ background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 6, padding: 12, fontSize: 12, color: "#94a3b8", overflowX: "auto", marginTop: 12, maxHeight: 250, overflowY: "auto" }}>
                {JSON.stringify(visionResult, null, 2)}
              </pre>
            )}
          </div>

          {/* Digital Audit Prospector */}
          <div>
            <p style={{ color: "#e2e8f0", fontSize: 14, fontWeight: 700, margin: "0 0 6px" }}>Digital Audit Prospector</p>
            <p style={{ color: "#64748b", fontSize: 12, margin: "0 0 10px" }}>Paste a contractor website URL — get a ready-to-send cold SMS pitch.</p>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                type="url"
                value={auditUrl}
                onChange={e => setAuditUrl(e.target.value)}
                placeholder="https://contractor-website.com"
                style={{ flex: 1, background: "#0a1628", border: "1px solid #1e3a5f", borderRadius: 6, padding: "9px 12px", color: "#e2e8f0", fontSize: 13 }}
              />
              <ActionButton label="Generate Pitch" onClick={runAudit} running={!!running["generate-digital-audit"]} />
            </div>
            {auditResult && (
              <div style={{ marginTop: 12, background: "#0a1628", border: "1px solid #00d4ff", borderRadius: 8, padding: "14px 16px" }}>
                <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, margin: "0 0 8px" }}>PITCH SMS — COPY & SEND:</p>
                <p style={{ color: "#e2e8f0", fontSize: 14, lineHeight: 1.6, margin: 0 }}>{auditResult}</p>
                <button
                  onClick={() => navigator.clipboard.writeText(auditResult)}
                  style={{ marginTop: 10, background: "none", border: "1px solid #1e3a5f", borderRadius: 5, padding: "5px 12px", color: "#64748b", fontSize: 11, cursor: "pointer" }}
                >Copy</button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Execution Log */}
      {log.length > 0 && (
        <div style={{ background: "#0f2342", border: "1px solid #1e3a5f", borderRadius: 10, padding: "18px 20px" }}>
          <p style={{ color: "#64748b", fontSize: 11, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase", margin: "0 0 12px" }}>EXECUTION LOG</p>
          <div style={{ display: "grid", gap: 10 }}>
            {log.map(entry => (
              <div key={entry.id} style={{ borderBottom: "1px solid #1e3a5f", paddingBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                  <span style={{ color: "#475569", fontSize: 11 }}>{entry.ts}</span>
                  <span style={{ color: "#e2e8f0", fontSize: 13, fontWeight: 600 }}>{entry.fn}</span>
                  <span style={{ color: statusColor(entry.status), fontSize: 12, fontWeight: 700, textTransform: "uppercase" }}>{entry.status}</span>
                </div>
                {entry.result !== undefined && <JsonBox data={entry.result} />}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";

type StepKey = "intro" | "missed_call" | "field_desk" | "site_radar" | "bundle" | "next";

const STEPS: { key: StepKey; title: string; tag: string }[] = [
  { key: "intro", title: "What we'd build for you", tag: "Intro" },
  { key: "missed_call", title: "Missed-Call Catch — never lose a job to voicemail", tag: "Module 1" },
  { key: "field_desk", title: "FieldDesk — dispatch + customer history", tag: "Module 2" },
  { key: "site_radar", title: "SiteRadar — see who's visiting your site", tag: "Module 3" },
  { key: "bundle", title: "$499 Website + FieldDesk bundle", tag: "Offer" },
  { key: "next", title: "Next steps", tag: "Wrap" },
];

export default function DemoRunner() {
  const [params] = useSearchParams();
  const name = params.get("name") ?? "";
  const company = params.get("company") ?? "";
  const email = params.get("email") ?? "";
  const phone = params.get("phone") ?? "";
  const website = params.get("website") ?? "";

  const greeting = useMemo(() => {
    const first = name.split(" ")[0];
    if (first && company) return `${first} @ ${company}`;
    if (company) return company;
    if (first) return first;
    return "Welcome";
  }, [name, company]);

  const [stepIdx, setStepIdx] = useState(0);
  const step = STEPS[stepIdx];

  useEffect(() => {
    document.title = company
      ? `Live demo for ${company} — Detroit Web Agency`
      : "Live demo — Detroit Web Agency";
  }, [company]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") setStepIdx((i) => Math.min(STEPS.length - 1, i + 1));
      if (e.key === "ArrowLeft") setStepIdx((i) => Math.max(0, i - 1));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "#0a1628", color: "#fff", fontFamily: "-apple-system,Segoe UI,sans-serif" }}>
      {/* Top bar */}
      <div style={{ borderBottom: "1px solid #1e3a5f", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
          <div style={{ color: "#00d4ff", fontWeight: 800, fontSize: 13, letterSpacing: 1.5, textTransform: "uppercase" }}>DWA · Live Demo</div>
          <div style={{ color: "#94a3b8", fontSize: 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {greeting}
          </div>
        </div>
        <div style={{ color: "#64748b", fontSize: 12 }}>
          {stepIdx + 1} / {STEPS.length}
        </div>
      </div>

      {/* Layout */}
      <div style={{ display: "grid", gridTemplateColumns: "260px 1fr", gap: 0, minHeight: "calc(100vh - 53px)" }}>
        {/* Sidebar */}
        <aside style={{ borderRight: "1px solid #1e3a5f", padding: "20px 14px", background: "#0c1a2e" }}>
          <div style={{ color: "#64748b", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 12 }}>
            Demo flow
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            {STEPS.map((s, i) => {
              const active = i === stepIdx;
              return (
                <button
                  key={s.key}
                  onClick={() => setStepIdx(i)}
                  style={{
                    textAlign: "left",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: `1px solid ${active ? "#00d4ff" : "transparent"}`,
                    background: active ? "rgba(0,212,255,0.08)" : "transparent",
                    color: active ? "#fff" : "#94a3b8",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 13,
                  }}
                >
                  <div style={{ color: "#64748b", fontSize: 10, letterSpacing: 1, textTransform: "uppercase", marginBottom: 2 }}>{s.tag}</div>
                  {s.title}
                </button>
              );
            })}
          </div>

          <div style={{ marginTop: 24, padding: 12, borderRadius: 8, background: "#0a1628", border: "1px solid #1e3a5f" }}>
            <div style={{ color: "#64748b", fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 6 }}>Prospect</div>
            <div style={{ fontSize: 13, fontWeight: 700 }}>{company || "—"}</div>
            {name && <div style={{ fontSize: 12, color: "#94a3b8", marginTop: 2 }}>{name}</div>}
            {email && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 6, wordBreak: "break-all" }}>{email}</div>}
            {phone && <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 2 }}>{phone}</div>}
            {website && (
              <div style={{ fontSize: 11, color: "#00d4ff", marginTop: 6, wordBreak: "break-all" }}>{website}</div>
            )}
          </div>
        </aside>

        {/* Stage */}
        <main style={{ padding: "32px 36px 80px" }}>
          <div style={{ color: "#00d4ff", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", fontWeight: 700 }}>{step.tag}</div>
          <h1 style={{ fontSize: 30, margin: "6px 0 22px", lineHeight: 1.2 }}>{step.title}</h1>

          <StepBody stepKey={step.key} company={company} website={website} firstName={name.split(" ")[0]} />

          {/* Footer nav */}
          <div style={{ marginTop: 40, display: "flex", gap: 10, alignItems: "center" }}>
            <button
              onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
              disabled={stepIdx === 0}
              style={navBtn(false, stepIdx === 0)}
            >
              ← Back
            </button>
            <button
              onClick={() => setStepIdx((i) => Math.min(STEPS.length - 1, i + 1))}
              disabled={stepIdx === STEPS.length - 1}
              style={navBtn(true, stepIdx === STEPS.length - 1)}
            >
              Next →
            </button>
            <div style={{ color: "#64748b", fontSize: 12, marginLeft: "auto" }}>← / → keys to navigate</div>
          </div>
        </main>
      </div>
    </div>
  );
}

function navBtn(primary: boolean, disabled: boolean): React.CSSProperties {
  return {
    padding: "12px 18px",
    borderRadius: 8,
    border: `1px solid ${primary ? "#00d4ff" : "#1e3a5f"}`,
    background: primary ? "#00d4ff" : "transparent",
    color: primary ? "#0a1628" : "#fff",
    fontWeight: 700,
    fontSize: 14,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.4 : 1,
  };
}

function StepBody({ stepKey, company, website, firstName }: { stepKey: StepKey; company: string; website: string; firstName: string }) {
  const c = company || "your shop";
  const f = firstName || "there";

  if (stepKey === "intro") {
    return (
      <Card>
        <p>Hey {f} — quick agenda for the next 15 minutes:</p>
        <ul style={ulStyle}>
          <li>How <strong>{c}</strong> is leaking jobs today (missed calls, slow follow-up, no visitor visibility)</li>
          <li>What we'd put in place — three modules, all under one roof</li>
          <li>The $499 website + FieldDesk bundle (first 90 days)</li>
          <li>Live look at a real Detroit contractor account</li>
        </ul>
        <p style={{ color: "#94a3b8" }}>I'll keep it tight. Stop me anytime.</p>
      </Card>
    );
  }

  if (stepKey === "missed_call") {
    return (
      <>
        <Card>
          <p><strong>The problem:</strong> the average trade business misses 27% of inbound calls. Each missed call = an estimated <strong>$240 lost job</strong>.</p>
          <p><strong>What we do:</strong> within 30 seconds of a missed call, we text the caller from your number with a friendly "Hey, sorry we missed you — what's going on?" That alone recovers ~40% of missed jobs.</p>
        </Card>
        <Card title="Live example — what the caller sees">
          <SmsBubble who="them">Called from (248) 555-0192 — no answer</SmsBubble>
          <SmsBubble who="you">Hey! This is {c}. Sorry we just missed you — what can we help with today?</SmsBubble>
          <SmsBubble who="them">Need someone out for a panel issue this week if possible</SmsBubble>
          <SmsBubble who="you">Got it — booking you for tomorrow 10am or Thursday 2pm. Which works?</SmsBubble>
        </Card>
      </>
    );
  }

  if (stepKey === "field_desk") {
    return (
      <>
        <Card>
          <p><strong>FieldDesk</strong> is the dashboard your office uses every day. One screen for jobs, customers, dispatch, and history.</p>
        </Card>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          {[
            { k: "Today's jobs", v: "8", sub: "3 in progress · 5 scheduled" },
            { k: "Unassigned", v: "2", sub: "Tap to dispatch" },
            { k: "Avg response", v: "11 min", sub: "↓ 38% vs last month" },
            { k: "Repeat customers", v: "67%", sub: "Last 90 days" },
          ].map((s) => (
            <div key={s.k} style={statCard}>
              <div style={{ color: "#64748b", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700 }}>{s.k}</div>
              <div style={{ fontSize: 28, fontWeight: 800, marginTop: 6 }}>{s.v}</div>
              <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 4 }}>{s.sub}</div>
            </div>
          ))}
        </div>
      </>
    );
  }

  if (stepKey === "site_radar") {
    return (
      <>
        <Card>
          <p><strong>SiteRadar</strong> sits on your website and tells you which <em>businesses</em> are visiting — even if they never fill out a form.</p>
          <p style={{ color: "#94a3b8" }}>Most contractors have no idea who's looking at their site. We turn that traffic into a callable list.</p>
        </Card>
        <Card title={website ? `What we'd see on ${website}` : "Sample visitor feed"}>
          <VisitorRow company="Henry Ford Health" pages={4} when="2 hours ago" hot />
          <VisitorRow company="Roush Industries" pages={2} when="Yesterday" />
          <VisitorRow company="DTE Energy" pages={6} when="2 days ago" hot />
          <VisitorRow company="Detroit Pistons HQ" pages={1} when="3 days ago" />
        </Card>
      </>
    );
  }

  if (stepKey === "bundle") {
    return (
      <>
        <Card title="The 90-day bundle">
          <div style={{ fontSize: 36, fontWeight: 800, color: "#00d4ff" }}>$499<span style={{ fontSize: 16, color: "#94a3b8", fontWeight: 500 }}> — first 90 days</span></div>
          <ul style={ulStyle}>
            <li>New website built for {c} (mobile-first, SEO-baked, lead capture)</li>
            <li>FieldDesk dispatch dashboard, fully set up</li>
            <li>Missed-Call Catch on your existing business line</li>
            <li>SiteRadar visitor tracking installed</li>
            <li>White-glove onboarding — we do the work, you approve</li>
          </ul>
          <p style={{ color: "#94a3b8" }}>After 90 days: $199/mo for FieldDesk, $99/mo for Missed-Call, $49/mo for SiteRadar. Cancel anything anytime.</p>
        </Card>
      </>
    );
  }

  // next
  return (
    <>
      <Card title="If this looks like a fit">
        <ol style={ulStyle}>
          <li>I'll send a one-page recap with everything we just covered</li>
          <li>You decide by Friday — no pressure, no follow-up spam</li>
          <li>If yes: we kick off Monday and your new site is live in 7 days</li>
        </ol>
        <p style={{ marginTop: 12 }}>
          Direct line: <strong style={{ color: "#00d4ff" }}>(313) 992-1219</strong> — text or call anytime.
        </p>
      </Card>
    </>
  );
}

function Card({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div style={{ border: "1px solid #1e3a5f", background: "#0c1a2e", borderRadius: 12, padding: 22, marginBottom: 14 }}>
      {title && <div style={{ color: "#00d4ff", fontSize: 12, letterSpacing: 1.5, textTransform: "uppercase", fontWeight: 700, marginBottom: 10 }}>{title}</div>}
      <div style={{ lineHeight: 1.6, fontSize: 15 }}>{children}</div>
    </div>
  );
}

function SmsBubble({ who, children }: { who: "you" | "them"; children: React.ReactNode }) {
  const isYou = who === "you";
  return (
    <div style={{ display: "flex", justifyContent: isYou ? "flex-end" : "flex-start", marginBottom: 8 }}>
      <div
        style={{
          maxWidth: "78%",
          padding: "10px 14px",
          borderRadius: 16,
          background: isYou ? "#00d4ff" : "#1e3a5f",
          color: isYou ? "#0a1628" : "#fff",
          fontSize: 14,
        }}
      >
        {children}
      </div>
    </div>
  );
}

function VisitorRow({ company, pages, when, hot }: { company: string; pages: number; when: string; hot?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid #1e3a5f" }}>
      <div>
        <div style={{ fontWeight: 700, fontSize: 14 }}>
          {company} {hot && <span style={{ marginLeft: 6, padding: "2px 8px", borderRadius: 999, background: "rgba(0,212,255,0.15)", color: "#00d4ff", fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>HOT</span>}
        </div>
        <div style={{ color: "#94a3b8", fontSize: 12, marginTop: 2 }}>{pages} pages viewed</div>
      </div>
      <div style={{ color: "#64748b", fontSize: 12 }}>{when}</div>
    </div>
  );
}

const ulStyle: React.CSSProperties = { margin: "10px 0 0", paddingLeft: 20, lineHeight: 1.7 };
const statCard: React.CSSProperties = { border: "1px solid #1e3a5f", background: "#0c1a2e", borderRadius: 10, padding: 16 };

import { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";

type StepKey = "intro" | "missed_call" | "field_desk" | "site_radar" | "before_after" | "live_dispatch" | "bundle" | "next";

const STEPS: { key: StepKey; title: string; tag: string }[] = [
  { key: "intro", title: "What we'd build for you", tag: "Intro" },
  { key: "missed_call", title: "Missed-Call Catch — never lose a job to voicemail", tag: "Module 1" },
  { key: "field_desk", title: "FieldDesk — dispatch + customer history", tag: "Module 2" },
  { key: "site_radar", title: "SiteRadar — see who's visiting your site", tag: "Module 3" },
  { key: "before_after", title: "Before vs After — your day in 2 columns", tag: "Compare" },
  { key: "live_dispatch", title: "Live dispatch — watch a job land", tag: "Live" },
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

  // localStorage step persistence — keyed by company+email so multi-prospect demos don't collide
  const stateKey = useMemo(() => `dwa:demo-runner:${company || "_"}:${email || "_"}`, [company, email]);
  const [stepIdx, setStepIdx] = useState(() => {
    if (typeof window === "undefined") return 0;
    const saved = parseInt(localStorage.getItem(stateKey) || "0", 10);
    return Number.isFinite(saved) && saved >= 0 && saved < STEPS.length ? saved : 0;
  });
  const step = STEPS[stepIdx];

  const setStep = useCallback((updater: number | ((i: number) => number)) => {
    setStepIdx((prev) => {
      const next = typeof updater === "function" ? updater(prev) : updater;
      const clamped = Math.max(0, Math.min(STEPS.length - 1, next));
      try { localStorage.setItem(stateKey, String(clamped)); } catch { /* private mode */ }
      return clamped;
    });
  }, [stateKey]);

  useEffect(() => {
    document.title = company
      ? `Live demo for ${company} — Detroit Web Agency`
      : "Live demo — Detroit Web Agency";
  }, [company]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (e.key === "ArrowRight") setStep((i) => i + 1);
      if (e.key === "ArrowLeft") setStep((i) => i - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [setStep]);

  return (
    <div className="min-h-screen bg-[#0a1628] text-white font-sans">
      {/* Top bar */}
      <header className="border-b border-[#1e3a5f] px-4 sm:px-5 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="text-[#00d4ff] font-extrabold text-[11px] sm:text-xs tracking-[0.15em] uppercase whitespace-nowrap">DWA · Live Demo</div>
          <div className="text-slate-400 text-xs sm:text-sm truncate">{greeting}</div>
        </div>
        <div className="text-slate-500 text-xs whitespace-nowrap">{stepIdx + 1} / {STEPS.length}</div>
      </header>

      {/* Mobile step pill row */}
      <nav className="md:hidden border-b border-[#1e3a5f] bg-[#0c1a2e] overflow-x-auto">
        <div className="flex gap-2 px-4 py-3 min-w-max">
          {STEPS.map((s, i) => {
            const active = i === stepIdx;
            return (
              <button key={s.key} onClick={() => setStep(i)}
                className={`flex-shrink-0 px-3 py-2 rounded-md text-xs font-bold transition ${
                  active ? "bg-[#00d4ff] text-[#0a1628]" : "bg-[#0a1628] text-slate-400 border border-[#1e3a5f]"
                }`}
              >
                {s.tag}
              </button>
            );
          })}
        </div>
      </nav>

      <div className="md:grid md:grid-cols-[260px_1fr] md:min-h-[calc(100vh-53px)]">
        {/* Desktop sidebar */}
        <aside className="hidden md:block border-r border-[#1e3a5f] bg-[#0c1a2e] p-4">
          <div className="text-slate-500 text-[11px] tracking-widest uppercase font-bold mb-3">Demo flow</div>
          <div className="grid gap-1.5">
            {STEPS.map((s, i) => {
              const active = i === stepIdx;
              return (
                <button key={s.key} onClick={() => setStep(i)}
                  className={`text-left px-3 py-2.5 rounded-lg text-[13px] font-semibold transition border ${
                    active ? "border-[#00d4ff] bg-[#00d4ff]/8 text-white" : "border-transparent text-slate-400 hover:bg-[#0a1628]"
                  }`}
                >
                  <div className="text-slate-500 text-[10px] tracking-widest uppercase font-bold mb-0.5">{s.tag}</div>
                  {s.title}
                </button>
              );
            })}
          </div>

          <div className="mt-6 p-3 rounded-lg bg-[#0a1628] border border-[#1e3a5f]">
            <div className="text-slate-500 text-[10px] tracking-widest uppercase font-bold mb-1.5">Prospect</div>
            <div className="text-[13px] font-bold">{company || "—"}</div>
            {name && <div className="text-xs text-slate-400 mt-0.5">{name}</div>}
            {email && <div className="text-[11px] text-slate-400 mt-1.5 break-all">{email}</div>}
            {phone && <div className="text-[11px] text-slate-400 mt-0.5">{phone}</div>}
            {website && <div className="text-[11px] text-[#00d4ff] mt-1.5 break-all">{website}</div>}
          </div>
        </aside>

        {/* Stage */}
        <main className="px-4 sm:px-6 md:px-9 py-6 md:py-8 pb-32">
          <div className="text-[#00d4ff] text-[11px] tracking-[0.2em] uppercase font-bold">{step.tag}</div>
          <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold leading-tight mt-1.5 mb-5">{step.title}</h1>

          <StepBody stepKey={step.key} company={company} website={website} firstName={name.split(" ")[0]} />

          <div className="mt-10 flex gap-2.5 items-center flex-wrap">
            <button onClick={() => setStep((i) => i - 1)} disabled={stepIdx === 0}
              className="px-4 py-3 rounded-lg border border-[#1e3a5f] text-white font-bold text-sm disabled:opacity-40 hover:border-[#00d4ff] transition"
            >← Back</button>
            <button onClick={() => setStep((i) => i + 1)} disabled={stepIdx === STEPS.length - 1}
              className="px-4 py-3 rounded-lg bg-[#00d4ff] text-[#0a1628] font-bold text-sm disabled:opacity-40 hover:bg-[#00b8df] transition"
            >Next →</button>
            <div className="text-slate-500 text-xs ml-auto hidden sm:block">← / → keys to navigate</div>
          </div>
        </main>
      </div>

      {/* Mobile sticky prospect bar */}
      {(company || name || phone) && (
        <div className="md:hidden fixed bottom-0 left-0 right-0 bg-[#0c1a2e]/95 backdrop-blur border-t border-[#1e3a5f] px-4 py-2.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Prospect</div>
              <div className="text-sm font-bold truncate">{company || name || "—"}</div>
            </div>
            {phone && <a href={`tel:${phone}`} className="bg-[#00d4ff] text-[#0a1628] font-bold text-xs px-3 py-2 rounded-md whitespace-nowrap">Call</a>}
          </div>
        </div>
      )}
    </div>
  );
}

function StepBody({ stepKey, company, website, firstName }: { stepKey: StepKey; company: string; website: string; firstName: string }) {
  const c = company || "your shop";
  const f = firstName || "there";

  if (stepKey === "intro") {
    return (
      <Card>
        <p>Hey {f} — quick agenda for the next 15 minutes:</p>
        <ul className="mt-3 pl-5 space-y-1.5 list-disc">
          <li>How <strong>{c}</strong> is leaking jobs today (missed calls, slow follow-up, no visitor visibility)</li>
          <li>What we'd put in place — three modules, all under one roof</li>
          <li>The $499 website + FieldDesk bundle (first 90 days)</li>
          <li>Live look at a real Detroit contractor account</li>
        </ul>
        <p className="text-slate-400 mt-3">I'll keep it tight. Stop me anytime.</p>
      </Card>
    );
  }

  if (stepKey === "missed_call") {
    return (
      <>
        <Card>
          <p><strong>The problem:</strong> the average trade business misses 27% of inbound calls. Each missed call = an estimated <strong>$240 lost job</strong>.</p>
          <p className="mt-3"><strong>What we do:</strong> within 30 seconds of a missed call, we text the caller from your number with a friendly "Hey, sorry we missed you — what's going on?" That alone recovers ~40% of missed jobs.</p>
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
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { k: "Today's jobs", v: "8", sub: "3 in progress · 5 scheduled" },
            { k: "Unassigned", v: "2", sub: "Tap to dispatch" },
            { k: "Avg response", v: "11 min", sub: "↓ 38% vs last month" },
            { k: "Repeat customers", v: "67%", sub: "Last 90 days" },
          ].map((s) => (
            <div key={s.k} className="border border-[#1e3a5f] bg-[#0c1a2e] rounded-lg p-4">
              <div className="text-slate-500 text-[10px] tracking-widest uppercase font-bold">{s.k}</div>
              <div className="text-2xl sm:text-3xl font-extrabold mt-1.5">{s.v}</div>
              <div className="text-slate-400 text-xs mt-1">{s.sub}</div>
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
          <p className="text-slate-400 mt-2">Most contractors have no idea who's looking at their site. We turn that traffic into a callable list.</p>
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

  if (stepKey === "before_after") {
    return (
      <>
        <Card>
          <p>Same day at <strong>{c}</strong> — without us, then with us.</p>
        </Card>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="border border-red-900/40 bg-red-950/20 rounded-xl p-5">
            <div className="text-red-400 text-xs uppercase tracking-widest font-bold mb-3">Before</div>
            <ul className="space-y-2.5 text-[14px]">
              <li className="flex gap-2"><span className="text-red-400">✗</span> Phone rings 14 times — 4 go to voicemail</li>
              <li className="flex gap-2"><span className="text-red-400">✗</span> Voicemails sit until lunch break</li>
              <li className="flex gap-2"><span className="text-red-400">✗</span> 2 callers already booked a competitor</li>
              <li className="flex gap-2"><span className="text-red-400">✗</span> Office staff manually re-types every job into 3 spreadsheets</li>
              <li className="flex gap-2"><span className="text-red-400">✗</span> Website got 47 visits — no idea who they were</li>
              <li className="flex gap-2"><span className="text-red-400">✗</span> Dispatch is texted "send the closest guy" — driver burns 22 min driving cross-town</li>
            </ul>
            <div className="mt-4 pt-4 border-t border-red-900/40 text-red-300 text-sm font-bold">≈ $960 in lost jobs · daily</div>
          </div>
          <div className="border-2 border-[#00d4ff] bg-[#00d4ff]/5 rounded-xl p-5">
            <div className="text-[#00d4ff] text-xs uppercase tracking-widest font-bold mb-3">After (DWA stack)</div>
            <ul className="space-y-2.5 text-[14px]">
              <li className="flex gap-2"><span className="text-[#00d4ff]">✓</span> Every missed call gets an auto-text in 30 seconds</li>
              <li className="flex gap-2"><span className="text-[#00d4ff]">✓</span> Voicemail → transcribed → dropped into FieldDesk job list</li>
              <li className="flex gap-2"><span className="text-[#00d4ff]">✓</span> Office sees one screen: jobs, customers, history</li>
              <li className="flex gap-2"><span className="text-[#00d4ff]">✓</span> Auto-dispatch picks the nearest tech from FieldDesk</li>
              <li className="flex gap-2"><span className="text-[#00d4ff]">✓</span> SiteRadar pings you when a callable business hits the site</li>
              <li className="flex gap-2"><span className="text-[#00d4ff]">✓</span> Matt is one text away — (313) 992-1219</li>
            </ul>
            <div className="mt-4 pt-4 border-t border-[#00d4ff]/40 text-[#00d4ff] text-sm font-bold">≈ $720 recovered · daily</div>
          </div>
        </div>
      </>
    );
  }

  if (stepKey === "live_dispatch") {
    return (
      <>
        <Card title="Live dispatch view">
          <p>Watch what happens when a new job lands in FieldDesk.</p>
        </Card>
        <LiveDispatchMock company={c} />
      </>
    );
  }

  if (stepKey === "bundle") {
    return (
      <Card title="The 90-day bundle">
        <div className="text-4xl sm:text-5xl font-extrabold text-[#00d4ff]">$499<span className="text-base text-slate-400 font-medium"> — first 90 days</span></div>
        <ul className="mt-3 pl-5 space-y-1.5 list-disc">
          <li>New website built for {c} (mobile-first, SEO-baked, lead capture)</li>
          <li>FieldDesk dispatch dashboard, fully set up</li>
          <li>Missed-Call Catch on your existing business line</li>
          <li>SiteRadar visitor tracking installed</li>
          <li>White-glove onboarding — we do the work, you approve</li>
        </ul>
        <p className="text-slate-400 mt-3">After 90 days: $199/mo for FieldDesk, $99/mo for Missed-Call, $49/mo for SiteRadar. Cancel anything anytime.</p>
        <a href={`/website-plus-fielddesk?company=${encodeURIComponent(c)}`} target="_blank" rel="noopener" className="inline-block mt-4 bg-[#00d4ff] text-[#0a1628] font-bold px-5 py-3 rounded-lg hover:bg-[#00b8df] transition">
          Open bundle page →
        </a>
      </Card>
    );
  }

  return (
    <Card title="If this looks like a fit">
      <ol className="pl-5 space-y-1.5 list-decimal">
        <li>I'll send a one-page recap with everything we just covered</li>
        <li>You decide by Friday — no pressure, no follow-up spam</li>
        <li>If yes: we kick off Monday and your new site is live in 7 days</li>
      </ol>
      <p className="mt-4">Direct line: <strong className="text-[#00d4ff]">(313) 992-1219</strong> — text or call anytime.</p>
    </Card>
  );
}

function Card({ children, title }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="border border-[#1e3a5f] bg-[#0c1a2e] rounded-xl p-5 sm:p-6 mb-3.5">
      {title && <div className="text-[#00d4ff] text-xs tracking-widest uppercase font-bold mb-2.5">{title}</div>}
      <div className="leading-relaxed text-[15px] text-slate-100">{children}</div>
    </div>
  );
}

function SmsBubble({ who, children }: { who: "you" | "them"; children: React.ReactNode }) {
  const isYou = who === "you";
  return (
    <div className={`flex mb-2 ${isYou ? "justify-end" : "justify-start"}`}>
      <div className={`max-w-[78%] px-3.5 py-2.5 rounded-2xl text-sm ${isYou ? "bg-[#00d4ff] text-[#0a1628]" : "bg-[#1e3a5f] text-white"}`}>
        {children}
      </div>
    </div>
  );
}

function VisitorRow({ company, pages, when, hot }: { company: string; pages: number; when: string; hot?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5 border-b border-[#1e3a5f] last:border-b-0">
      <div>
        <div className="font-bold text-sm">
          {company}
          {hot && <span className="ml-2 px-2 py-0.5 rounded-full bg-[#00d4ff]/15 text-[#00d4ff] text-[10px] font-extrabold tracking-widest">HOT</span>}
        </div>
        <div className="text-slate-400 text-xs mt-0.5">{pages} pages viewed</div>
      </div>
      <div className="text-slate-500 text-xs">{when}</div>
    </div>
  );
}

function LiveDispatchMock({ company }: { company: string }) {
  const [stage, setStage] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setStage(1), 1000);
    const t2 = setTimeout(() => setStage(2), 2400);
    const t3 = setTimeout(() => setStage(3), 4000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div className="border border-[#1e3a5f] bg-[#0c1a2e] rounded-xl p-5 space-y-3">
      <div className="flex items-center justify-between">
        <div className="text-[#00d4ff] text-xs tracking-widest uppercase font-bold">{company} · FieldDesk</div>
        <div className="flex items-center gap-1.5 text-xs text-green-400">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span> Live
        </div>
      </div>

      <div className={`p-4 rounded-lg border-2 transition-all duration-500 ${stage >= 1 ? "border-[#00d4ff] bg-[#00d4ff]/5" : "border-[#1e3a5f] bg-[#0a1628]"}`}>
        <div className="text-xs text-slate-400 uppercase tracking-widest font-bold">Incoming job</div>
        {stage >= 1 ? (
          <>
            <div className="font-bold text-[15px] mt-1">⚡ Panel issue · 1428 Brush St, Detroit</div>
            <div className="text-sm text-slate-300 mt-1">"Lights flickering, smells warm" · Caller: Sarah K. · (248) 555-0192</div>
          </>
        ) : <div className="text-slate-600 text-sm mt-1">waiting…</div>}
      </div>

      <div className={`p-4 rounded-lg border transition-all duration-500 ${stage >= 2 ? "border-[#00d4ff] bg-[#0a1628]" : "border-[#1e3a5f] bg-[#0a1628] opacity-40"}`}>
        <div className="text-xs text-slate-400 uppercase tracking-widest font-bold">Auto-dispatch</div>
        {stage >= 2 ? (
          <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
            <div className="p-2 rounded bg-[#0c1a2e] border border-[#1e3a5f]"><div className="font-bold">Mike T.</div><div className="text-slate-400">12 min away ✓</div></div>
            <div className="p-2 rounded bg-[#0c1a2e] border border-[#1e3a5f] opacity-50"><div className="font-bold">Jose R.</div><div className="text-slate-400">28 min</div></div>
            <div className="p-2 rounded bg-[#0c1a2e] border border-[#1e3a5f] opacity-50"><div className="font-bold">Dave L.</div><div className="text-slate-400">on job</div></div>
          </div>
        ) : <div className="text-slate-600 text-sm mt-1">computing nearest tech…</div>}
      </div>

      <div className={`p-4 rounded-lg border transition-all duration-500 ${stage >= 3 ? "border-green-500 bg-green-500/5" : "border-[#1e3a5f] bg-[#0a1628] opacity-40"}`}>
        <div className="text-xs text-slate-400 uppercase tracking-widest font-bold">Dispatched</div>
        {stage >= 3 ? (
          <>
            <div className="font-bold text-[15px] mt-1 text-green-400">✓ Mike T. en route — ETA 12 min</div>
            <div className="text-sm text-slate-300 mt-1">Sarah auto-texted: "Mike is heading over now, ETA 12 min. He'll text when 5 min out."</div>
          </>
        ) : <div className="text-slate-600 text-sm mt-1">routing…</div>}
      </div>

      <button onClick={() => setStage(0)} className="text-xs text-slate-500 underline">Replay</button>
    </div>
  );
}

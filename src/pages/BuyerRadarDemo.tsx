import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import {
  Factory, Target, Radar, FileText, Layers, Trophy,
  ArrowRight, ArrowLeft, CheckCircle2, MapPin, Award, Users, TrendingUp, Loader2, Database,
} from "lucide-react";

type Step = {
  num: number;
  icon: any;
  title: string;
  blurb: string;
};

const STEPS: Step[] = [
  { num: 1, icon: Target, title: "Targeting",      blurb: "We narrow the universe down to YOUR buyers — by NAICS, geography, and capital signals." },
  { num: 2, icon: Radar,  title: "Signal Detection", blurb: "Public + government data is scanned daily for buyer-intent moves." },
  { num: 3, icon: FileText, title: "RFQ Intercept",  blurb: "SAM.gov + state portals filtered to fab-metal NAICS in MI / OH / IN." },
  { num: 4, icon: Layers, title: "Tier Routing",   blurb: "Each signal flows to the tier that asked for it — Core, Pro, or Enterprise." },
  { num: 5, icon: Trophy, title: "Outcome",        blurb: "Your salespeople walk into Monday already knowing." },
];

// ---------- Sample (demo-mode) data ----------
const SAMPLE_TARGETS = [
  { name: "Acme Auto Parts", city: "Warren, MI", naics: "332710", trigger: "Permit pulled $1.8M expansion" },
  { name: "ABC Defense", city: "Sterling Heights, MI", naics: "336992", trigger: "$4.2M Army contract awarded" },
  { name: "Midwest Stamping", city: "Toledo, OH", naics: "332119", trigger: "4 welder jobs posted this week" },
  { name: "Lakeshore Fab", city: "Muskegon, MI", naics: "332312", trigger: "SBA 504 approved $2.1M" },
];

const SAMPLE_SIGNALS = [
  { type: "Federal Contract", company: "ABC Defense", city: "Sterling Heights, MI", confidence: 9, summary: "$4.2M Army armored vehicle contract — needs structural steel within 90 days." },
  { type: "Permit Surge",     company: "Acme Auto Parts", city: "Warren, MI", confidence: 8, summary: "$1.8M expansion permit — mezzanine, racking, structural fab opportunity." },
  { type: "Hiring Pattern",   company: "Midwest Stamping", city: "Toledo, OH", confidence: 7, summary: "4 welder + 2 fabricator jobs this week — production ramp." },
  { type: "SBA 504 Loan",     company: "Lakeshore Fab", city: "Muskegon, MI", confidence: 8, summary: "$2.1M expansion capital approved — buying season starts now." },
];

const SAMPLE_RFQS = [
  { title: "Welded steel guardrails — I-75 corridor", agency: "MDOT", naics: "332312", state: "MI", due: "5 days" },
  { title: "Sheet metal enclosures — Ohio National Guard", agency: "DLA Land", naics: "332311", state: "OH", due: "9 days" },
  { title: "Precision machined hydraulic blocks", agency: "US Army TACOM", naics: "333613", state: "MI", due: "12 days" },
];

export default function BuyerRadarDemo() {
  const [step, setStep] = useState(1);
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [useLive, setUseLive] = useState(false);
  const [liveLoading, setLiveLoading] = useState(false);
  const [liveSignals, setLiveSignals] = useState<any[]>([]);
  const [liveRfqs, setLiveRfqs] = useState<any[]>([]);
  const [liveError, setLiveError] = useState<string | null>(null);

  useEffect(() => {
    if (!useLive || !isAdmin) return;
    let cancelled = false;
    (async () => {
      setLiveLoading(true);
      setLiveError(null);
      try {
        const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const [{ data: sigs, error: e1 }, { data: rs, error: e2 }] = await Promise.all([
          supabase.from("industry_pulse_signals" as any)
            .select("id,company_name,industry,location,confidence,source_summary,detected_at,signal_type")
            .gte("detected_at", since)
            .order("confidence", { ascending: false }).limit(8),
          supabase.from("buyer_radar_rfqs" as any)
            .select("id,title,agency,naics,state,city,url,due_at,posted_at,detected_at")
            .order("detected_at", { ascending: false }).limit(8),
        ]);
        if (cancelled) return;
        if (e1) throw e1;
        if (e2) throw e2;
        setLiveSignals((sigs as any[]) || []);
        setLiveRfqs((rs as any[]) || []);
      } catch (e: any) {
        if (!cancelled) setLiveError(e?.message || "Failed to load live data");
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [useLive, isAdmin]);

  const showLive = useLive && isAdmin;

  const signalsToShow = useMemo(() => {
    if (!showLive) return null;
    return liveSignals.map((s) => ({
      type: s.signal_type || "Buyer Signal",
      company: s.company_name || "—",
      city: s.location || "—",
      confidence: s.confidence ?? 5,
      summary: s.source_summary || "",
    }));
  }, [showLive, liveSignals]);

  const rfqsToShow = useMemo(() => {
    if (!showLive) return null;
    return liveRfqs.map((r) => {
      const due = r.due_at ? Math.max(0, Math.ceil((new Date(r.due_at).getTime() - Date.now()) / 86400000)) : null;
      return {
        title: r.title, agency: r.agency || "—",
        naics: r.naics || "—", state: r.state || "—",
        due: due == null ? "—" : `${due} days`,
      };
    });
  }, [showLive, liveRfqs]);

  return (
    <div className="min-h-screen bg-[#030711] text-white">
      <SEOHead
        title="Buyer Radar — Interactive Demo | Detroit Web Agency"
        description="Walk through how Buyer Radar finds Metro Detroit manufacturers about to buy steel, fab work, and machining."
      />

      <header className="border-b border-[#1e3a5f] bg-[#0a1628]/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/buyer-radar" className="flex items-center gap-2">
            <Factory className="w-5 h-5 text-[#00d4ff]" />
            <span className="font-bold tracking-tight">Buyer Radar</span>
            <span className="text-xs text-[#64748b] uppercase tracking-widest hidden sm:inline">Interactive Demo</span>
          </Link>
          <div className="flex items-center gap-4">
            {!adminLoading && isAdmin && (
              <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
                <Database className="w-4 h-4 text-[#00d4ff]" />
                <span className="hidden sm:inline text-[#94a3b8]">Use live data</span>
                <Switch checked={useLive} onCheckedChange={setUseLive} />
                {useLive && <span className="px-2 py-0.5 rounded bg-[#00d4ff]/20 text-[#00d4ff] text-[10px] font-bold tracking-wider">LIVE</span>}
              </label>
            )}
            <Link to="/buyer-radar/pricing" className="text-sm text-[#00d4ff] font-semibold">Pricing →</Link>
          </div>
        </div>
        {/* Step progress */}
        <div className="max-w-6xl mx-auto px-4 pb-4">
          <div className="flex items-center gap-2">
            {STEPS.map((s) => (
              <div key={s.num} className="flex-1">
                <div
                  className={`h-1.5 rounded-full ${s.num <= step ? "bg-[#00d4ff]" : "bg-[#1e3a5f]"}`}
                />
                <p className={`text-[10px] mt-1 uppercase tracking-widest ${s.num === step ? "text-[#00d4ff]" : "text-[#64748b]"}`}>
                  {s.num}. {s.title}
                </p>
              </div>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-10">
        {/* Step body */}
        <section className="bg-[#0a1628] border border-[#1e3a5f] rounded-2xl p-6 sm:p-10 min-h-[420px]">
          <div className="flex items-center gap-3 mb-3">
            {STEPS.filter((s) => s.num === step).map((s) => (
              <s.icon key={s.num} className="w-7 h-7 text-[#00d4ff]" />
            ))}
            <h1 className="text-2xl sm:text-3xl font-extrabold">
              Step {step}. {STEPS[step - 1].title}
            </h1>
          </div>
          <p className="text-[#94a3b8] mb-8">{STEPS[step - 1].blurb}</p>

          {step === 1 && <StepTargeting />}
          {step === 2 && (
            <StepSignals
              live={showLive}
              loading={liveLoading}
              error={liveError}
              data={signalsToShow ?? SAMPLE_SIGNALS}
            />
          )}
          {step === 3 && (
            <StepRfqs
              live={showLive}
              loading={liveLoading}
              error={liveError}
              data={rfqsToShow ?? SAMPLE_RFQS}
            />
          )}
          {step === 4 && <StepRouting />}
          {step === 5 && <StepOutcome />}
        </section>

        {/* Nav */}
        <div className="flex items-center justify-between mt-6">
          <Button
            variant="outline"
            disabled={step === 1}
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            className="border-[#1e3a5f] text-white hover:bg-[#0a1628]"
          >
            <ArrowLeft className="w-4 h-4 mr-2" /> Back
          </Button>
          {step < STEPS.length ? (
            <Button
              onClick={() => setStep((s) => Math.min(STEPS.length, s + 1))}
              className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90 font-bold"
            >
              Next: {STEPS[step].title} <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          ) : (
            <Link to="/buyer-radar#plans">
              <Button className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90 font-bold">
                See Pricing <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
            </Link>
          )}
        </div>

        {showLive && (
          <p className="text-center text-xs text-[#64748b] mt-6">
            Live data from your production database. Signals from the last 30 days, RFQs from the last scan.
          </p>
        )}
      </main>
    </div>
  );
}

function StepTargeting() {
  return (
    <div className="grid sm:grid-cols-2 gap-6">
      <div>
        <h3 className="font-bold text-white mb-3">The funnel</h3>
        <ul className="space-y-2 text-sm">
          <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-[#00d4ff] mt-0.5" /> NAICS 332 / 333 / 336 (fab-metal, machinery, transport equipment)</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-[#00d4ff] mt-0.5" /> States: MI / OH / IN</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-[#00d4ff] mt-0.5" /> Capital signals: contract wins, permits, SBA loans, hiring</li>
          <li className="flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-[#00d4ff] mt-0.5" /> Excludes pure resellers, brokers, fab-less shops</li>
        </ul>
      </div>
      <div className="bg-[#030711] border border-[#1e3a5f] rounded-lg p-4">
        <p className="text-xs text-[#64748b] uppercase tracking-widest mb-3">Sample matched accounts</p>
        <ul className="space-y-3">
          {SAMPLE_TARGETS.map((t) => (
            <li key={t.name} className="text-sm">
              <div className="flex items-center gap-2 font-bold text-white"><MapPin className="w-3 h-3 text-[#00d4ff]" />{t.name}</div>
              <p className="text-xs text-[#94a3b8] ml-5">{t.city} · NAICS {t.naics}</p>
              <p className="text-xs text-[#00d4ff] ml-5">{t.trigger}</p>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function StepSignals({ live, loading, error, data }: { live: boolean; loading: boolean; error: string | null; data: any[] }) {
  if (live && loading) return <div className="flex items-center gap-2 text-[#94a3b8]"><Loader2 className="animate-spin w-4 h-4" /> Pulling live signals…</div>;
  if (live && error)   return <p className="text-amber-400 text-sm">Live load failed: {error}</p>;
  if (live && data.length === 0) return <p className="text-[#94a3b8] text-sm">No signals in the last 30 days. Scanner runs daily.</p>;
  return (
    <div className="space-y-3">
      {data.map((s, i) => {
        const conf = s.confidence ?? 0;
        const color = conf >= 8 ? "#22c55e" : conf >= 6 ? "#00d4ff" : "#94a3b8";
        return (
          <div key={i} className="bg-[#030711] border border-[#1e3a5f] rounded-lg p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <Award className="w-4 h-4 text-[#00d4ff]" />
                  <span className="text-xs font-bold uppercase tracking-widest text-[#00d4ff]">{s.type}</span>
                </div>
                <h3 className="font-bold text-white">{s.company}</h3>
                <p className="text-xs text-[#94a3b8]">{s.city}</p>
                {s.summary && <p className="text-sm text-[#cbd5e1] mt-2">{s.summary}</p>}
              </div>
              <span style={{ background: `${color}20`, color }} className="text-xs font-extrabold px-2 py-1 rounded whitespace-nowrap">
                {conf}/10
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StepRfqs({ live, loading, error, data }: { live: boolean; loading: boolean; error: string | null; data: any[] }) {
  if (live && loading) return <div className="flex items-center gap-2 text-[#94a3b8]"><Loader2 className="animate-spin w-4 h-4" /> Pulling live RFQs…</div>;
  if (live && error)   return <p className="text-amber-400 text-sm">Live load failed: {error}</p>;
  if (live && data.length === 0) return <p className="text-[#94a3b8] text-sm">No active RFQs in scope. Scanner runs daily.</p>;
  return (
    <div className="space-y-3">
      {data.map((r, i) => (
        <div key={i} className="bg-[#030711] border border-[#1e3a5f] rounded-lg p-4">
          <h3 className="font-bold text-white">{r.title}</h3>
          <p className="text-xs text-[#94a3b8] mt-1">{r.agency} · NAICS {r.naics} · {r.state}</p>
          <p className="text-xs text-amber-400 mt-2">Due in {r.due}</p>
        </div>
      ))}
    </div>
  );
}

function StepRouting() {
  const rows = [
    { signal: "Federal contract awards",  core: true,  pro: true, ent: true },
    { signal: "Commercial building permits", core: true,  pro: true, ent: true },
    { signal: "Hiring surges (welder/fabricator)", core: true,  pro: true, ent: true },
    { signal: "SBA 504 approvals",        core: true,  pro: true, ent: true },
    { signal: "Named-account watchlist",  core: false, pro: true, ent: true },
    { signal: "Quarterly competitor report", core: false, pro: true, ent: true },
    { signal: "Daily RFQ intercept (SAM.gov + state)", core: false, pro: false, ent: true },
  ];
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-widest text-[#64748b] border-b border-[#1e3a5f]">
            <th className="py-3">Signal type</th>
            <th className="py-3 text-center">Core</th>
            <th className="py-3 text-center">Pro</th>
            <th className="py-3 text-center">Enterprise</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.signal} className="border-b border-[#1e3a5f]/50">
              <td className="py-3 text-white">{r.signal}</td>
              <td className="py-3 text-center">{r.core ? <CheckCircle2 className="w-4 h-4 text-[#00d4ff] mx-auto" /> : <span className="text-[#1e3a5f]">—</span>}</td>
              <td className="py-3 text-center">{r.pro ? <CheckCircle2 className="w-4 h-4 text-[#00d4ff] mx-auto" /> : <span className="text-[#1e3a5f]">—</span>}</td>
              <td className="py-3 text-center">{r.ent ? <CheckCircle2 className="w-4 h-4 text-[#00d4ff] mx-auto" /> : <span className="text-[#1e3a5f]">—</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function StepOutcome() {
  return (
    <div>
      <div className="bg-[#030711] border border-[#00d4ff]/30 rounded-lg p-6 mb-6">
        <p className="text-xl text-white font-bold leading-snug">
          "Your salesperson walks into Monday with 6 named accounts that moved last week — and 2 RFQs already on their desk."
        </p>
      </div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div className="text-center">
          <Users className="w-8 h-8 text-[#00d4ff] mx-auto mb-2" />
          <p className="font-bold text-white">6 hot accounts/wk</p>
          <p className="text-xs text-[#94a3b8]">Named by signal</p>
        </div>
        <div className="text-center">
          <FileText className="w-8 h-8 text-[#00d4ff] mx-auto mb-2" />
          <p className="font-bold text-white">2-3 RFQs/wk</p>
          <p className="text-xs text-[#94a3b8]">Filtered to your NAICS</p>
        </div>
        <div className="text-center">
          <TrendingUp className="w-8 h-8 text-[#00d4ff] mx-auto mb-2" />
          <p className="font-bold text-white">10:1 ROI</p>
          <p className="text-xs text-[#94a3b8]">One closed deal pays years</p>
        </div>
      </div>
    </div>
  );
}

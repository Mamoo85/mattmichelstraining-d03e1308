import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import DispatchBoard from "@/components/field-service/DispatchBoard";
import TechMap from "@/components/field-service/TechMap";
import SEOHead from "@/components/layout/SEOHead";
import { ArrowLeft, ClipboardList, Map, Smartphone } from "lucide-react";
import { trackEvent as trackPostHog } from "@/lib/posthog";

type Tab = "dispatch" | "map" | "tech";

const TABS = [
  { id: "dispatch" as const, label: "Dispatch", icon: ClipboardList },
  { id: "map" as const, label: "Tech Map", icon: Map },
  { id: "tech" as const, label: "Tech App", icon: Smartphone },
];
const TAB_IDS: Tab[] = ["dispatch", "map", "tech"];

/** Fire to PostHog + GA4 in one call */
const trackDemo = (event: string, props: Record<string, unknown> = {}) => {
  const payload = { surface: "fielddesk_demo", ...props };
  try { trackPostHog(event, payload); } catch {}
  try {
    if (typeof window !== "undefined" && (window as any).gtag) {
      (window as any).gtag("event", event, payload);
    }
  } catch {}
};

const FieldDeskDemo = () => {
  const [tab, setTab] = useState<Tab>("dispatch");
  const touchStartX = useRef<number | null>(null);
  const viewedTabs = useRef<Set<Tab>>(new Set());

  // Page view + initial tab view
  useEffect(() => {
    trackDemo("demo_page_view", { path: window.location.pathname });
    viewedTabs.current.add("dispatch");
    trackDemo("demo_tab_view", { tab: "dispatch", method: "initial" });
  }, []);

  const switchTab = (next: Tab, method: "click" | "swipe") => {
    if (next === tab) return;
    setTab(next);
    const firstView = !viewedTabs.current.has(next);
    viewedTabs.current.add(next);
    trackDemo("demo_tab_view", { tab: next, method, first_view: firstView });
  };

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (Math.abs(dx) < 50) return;
    const idx = TAB_IDS.indexOf(tab);
    if (dx < 0 && idx < TAB_IDS.length - 1) switchTab(TAB_IDS[idx + 1], "swipe");
    if (dx > 0 && idx > 0) switchTab(TAB_IDS[idx - 1], "swipe");
  };

  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      <SEOHead
        title="FieldDesk Demo — See It On Your Phone | Detroit Web Agency"
        description="Live interactive demo of FieldDesk — dispatch board, real-time tech map, and mobile tech app. No signup required."
        path="/fielddesk-demo"
      />

      {/* Top bar */}
      <header className="border-b border-[#1e3a5f] bg-[#0f1f35] px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <Link to="/" className="flex items-center gap-2 text-sm text-gray-400 hover:text-white">
          <ArrowLeft size={16} /> Back
        </Link>
        <div className="text-center">
          <div className="text-xs text-[#00d4ff] font-bold uppercase tracking-widest">FieldDesk · Live Demo</div>
          <div className="text-[10px] text-gray-500">Sample data · No login required</div>
        </div>
        <a
          href="tel:+13139921219"
          className="text-[11px] font-bold text-[#00d4ff] border border-[#00d4ff]/40 rounded-full px-3 py-1 hover:bg-[#00d4ff]/10"
        >
          Call
        </a>
      </header>

      {/* Demo phone-frame on desktop, full width on mobile */}
      <div className="max-w-md mx-auto px-3 py-3">
        {/* Tabs — sticky, larger tap targets */}
        <div className="sticky top-[57px] z-10 -mx-3 px-3 pb-2 pt-2 bg-[#0a1628]">
          <div
            role="tablist"
            aria-label="FieldDesk demo sections"
            className="grid grid-cols-3 gap-1 bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl p-1"
          >
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(id)}
                  className={`flex flex-col items-center justify-center gap-1 min-h-[52px] px-1 rounded-xl text-[11px] font-bold leading-tight transition active:scale-95 ${
                    active ? "bg-[#00d4ff] text-[#0a1628] shadow-[0_2px_8px_rgba(0,212,255,0.3)]" : "text-gray-400 hover:text-white"
                  }`}
                >
                  <Icon size={18} />
                  <span className="truncate max-w-full">{label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab content — swipeable */}
        <div
          className="bg-[#0f1f35] border border-[#1e3a5f] rounded-2xl overflow-hidden touch-pan-y mt-1"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          {tab === "dispatch" && <DispatchBoard clientId="demo" />}
          {tab === "map" && <TechMap clientId="demo" />}
          {tab === "tech" && <TechAppPreview />}
        </div>

        {/* Swipe hint */}
        <p className="text-center text-[10px] text-gray-500 mt-2">← Swipe to switch tabs →</p>

        {/* QR — scan to open on phone */}
        <div className="mt-6 bg-white rounded-2xl p-5 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-[#0a1628] mb-3">
            📱 Scan to open on your phone
          </p>
          <img
            src="https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=https%3A%2F%2Fdetroitwebagent.com%2Ffielddesk-demo"
            alt="Scan to open FieldDesk demo on your phone"
            width={200}
            height={200}
            className="mx-auto block"
          />
          <p className="text-[10px] text-gray-600 mt-3 font-mono">detroitwebagent.com/fielddesk-demo</p>
        </div>

        {/* CTA */}
        <div className="mt-4 bg-gradient-to-br from-[#00d4ff]/15 to-[#00d4ff]/5 border border-[#00d4ff]/40 rounded-2xl p-5 text-center">
          <p className="text-sm text-gray-300 mb-1">Like what you see?</p>
          <p className="text-lg font-black mb-4">Get FieldDesk for your shop.</p>
          <a
            href="tel:+13139921219"
            className="inline-block bg-[#00d4ff] text-[#0a1628] font-black px-6 py-3 rounded-full text-sm hover:opacity-90"
          >
            Call (313) 992-1219
          </a>
          <p className="text-[10px] text-gray-500 mt-3">Built by Detroit Web Agency · detroitwebagent.com</p>
        </div>
      </div>
    </div>
  );
};

type JobStatus = "Scheduled" | "En route" | "On site" | "Complete";
type DemoJob = {
  id: string;
  time: string;
  customer: string;
  customerPhone: string;
  address: string;
  type: string;
  status: JobStatus;
};

const INITIAL_JOBS: DemoJob[] = [
  { id: "j1", time: "8:00 AM", customer: "GM Warren Plant", customerPhone: "+15865551001", address: "30001 Van Dyke Ave, Warren, MI", type: "Boiler PM", status: "En route" },
  { id: "j2", time: "10:30 AM", customer: "Henry Ford Hospital", customerPhone: "+13135552002", address: "2799 W Grand Blvd, Detroit, MI", type: "Steam line repair", status: "On site" },
  { id: "j3", time: "1:00 PM", customer: "Stellantis SHAP", customerPhone: "+15865553003", address: "2000 Sterling Ave, Sterling Heights, MI", type: "Quarterly inspection", status: "Scheduled" },
  { id: "j4", time: "3:30 PM", customer: "DTE Conners Creek", customerPhone: "+13135554004", address: "11700 Freud St, Detroit, MI", type: "Emergency call", status: "Scheduled" },
];

const NEXT_STATUS: Record<JobStatus, JobStatus> = {
  "Scheduled": "En route",
  "En route": "On site",
  "On site": "Complete",
  "Complete": "Complete",
};

const ACTION_LABEL: Record<JobStatus, string> = {
  "Scheduled": "Start Job",
  "En route": "Arrive On Site",
  "On site": "Complete Job",
  "Complete": "Done ✓",
};

const STATUS_STYLE: Record<JobStatus, string> = {
  "Scheduled": "bg-gray-500/20 text-gray-400",
  "En route": "bg-yellow-500/20 text-yellow-400",
  "On site": "bg-green-500/20 text-green-400",
  "Complete": "bg-[#00d4ff]/20 text-[#00d4ff]",
};

type Toast = { id: number; text: string };

const TechAppPreview = () => {
  const [jobs, setJobs] = useState<DemoJob[]>(INITIAL_JOBS);
  const [toasts, setToasts] = useState<Toast[]>([]);

  const pushToast = (text: string) => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  };

  const handleNavigate = (job: DemoJob) => {
    pushToast(`📍 Opening Maps to ${job.customer}…`);
    pushToast(`📲 Auto-text sent to customer: "Tech is 10 min away"`);
    // Demo: also bump Scheduled → En route
    if (job.status === "Scheduled") {
      setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: "En route" } : j)));
    }
  };

  const handleAction = (job: DemoJob) => {
    if (job.status === "Complete") return;
    const next = NEXT_STATUS[job.status];
    setJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: next } : j)));
    if (next === "En route") pushToast(`🚐 En route to ${job.customer} — customer notified`);
    if (next === "On site") pushToast(`✅ Checked in at ${job.customer} · Timer started`);
    if (next === "Complete") pushToast(`💵 ${job.customer} — invoice auto-generated & emailed`);
  };

  return (
    <div className="p-4 space-y-4 relative">
      <div className="text-center">
        <div className="inline-block bg-[#00d4ff]/20 border border-[#00d4ff]/40 rounded-full px-3 py-1 text-[10px] font-bold text-[#00d4ff] uppercase tracking-widest mb-2">
          Tech: Mike Johnson
        </div>
        <p className="text-xs text-gray-400">Today's route · {jobs.filter((j) => j.status !== "Complete").length} stops left</p>
      </div>

      {jobs.map((job) => {
        const isComplete = job.status === "Complete";
        return (
          <div key={job.id} className={`bg-[#0a1628] border rounded-xl p-3 transition ${isComplete ? "border-[#00d4ff]/40 opacity-70" : "border-[#1e3a5f]"}`}>
            <div className="flex justify-between items-start mb-1">
              <span className="text-[#00d4ff] font-bold text-xs">{job.time}</span>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_STYLE[job.status]}`}>{job.status}</span>
            </div>
            <p className={`font-semibold text-sm ${isComplete ? "text-gray-400 line-through" : "text-white"}`}>{job.customer}</p>
            <p className="text-gray-400 text-xs mt-1">{job.type}</p>
            <div className="flex gap-2 mt-3">
              <button
                onClick={() => handleNavigate(job)}
                disabled={isComplete}
                className="flex-1 bg-[#00d4ff] text-[#0a1628] text-[11px] font-bold py-2.5 rounded-lg active:scale-95 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Navigate
              </button>
              <button
                onClick={() => handleAction(job)}
                disabled={isComplete}
                className="flex-1 border border-[#1e3a5f] text-white text-[11px] font-bold py-2.5 rounded-lg active:scale-95 transition hover:bg-[#1e3a5f]/40 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {ACTION_LABEL[job.status]}
              </button>
            </div>
          </div>
        );
      })}

      <div className="text-center text-[10px] text-gray-500 pt-2">
        Tap the buttons — every action auto-texts the customer & updates the office in real time.
      </div>

      {/* Toast stack */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 flex flex-col gap-2 w-[90%] max-w-sm pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className="bg-[#00d4ff] text-[#0a1628] text-xs font-bold px-4 py-3 rounded-xl shadow-2xl animate-in slide-in-from-bottom-4 fade-in"
          >
            {t.text}
          </div>
        ))}
      </div>
    </div>
  );
};

export default FieldDeskDemo;

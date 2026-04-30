import { useState } from "react";
import { Link } from "react-router-dom";
import DispatchBoard from "@/components/field-service/DispatchBoard";
import TechMap from "@/components/field-service/TechMap";
import SEOHead from "@/components/layout/SEOHead";
import { ArrowLeft, ClipboardList, Map, Smartphone } from "lucide-react";

type Tab = "dispatch" | "map" | "tech";

const FieldDeskDemo = () => {
  const [tab, setTab] = useState<Tab>("dispatch");

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

const DEMO_JOBS_TODAY = [
  { time: "8:00 AM", customer: "GM Warren Plant", type: "Boiler PM", tech: "Mike J.", status: "En route" },
  { time: "10:30 AM", customer: "Henry Ford Hospital", type: "Steam line repair", tech: "Tony R.", status: "On site" },
  { time: "1:00 PM", customer: "Stellantis SHAP", type: "Quarterly inspection", tech: "Dan K.", status: "Scheduled" },
  { time: "3:30 PM", customer: "DTE Conners Creek", type: "Emergency call", tech: "Chris O.", status: "Scheduled" },
];

const TechAppPreview = () => (
  <div className="p-4 space-y-4">
    <div className="text-center">
      <div className="inline-block bg-[#00d4ff]/20 border border-[#00d4ff]/40 rounded-full px-3 py-1 text-[10px] font-bold text-[#00d4ff] uppercase tracking-widest mb-2">
        Tech: Mike Johnson
      </div>
      <p className="text-xs text-gray-400">Today's route · 4 stops</p>
    </div>

    {DEMO_JOBS_TODAY.map((job, i) => (
      <div key={i} className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-3">
        <div className="flex justify-between items-start mb-1">
          <span className="text-[#00d4ff] font-bold text-xs">{job.time}</span>
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
            job.status === "On site" ? "bg-green-500/20 text-green-400" :
            job.status === "En route" ? "bg-yellow-500/20 text-yellow-400" :
            "bg-gray-500/20 text-gray-400"
          }`}>{job.status}</span>
        </div>
        <p className="text-white font-semibold text-sm">{job.customer}</p>
        <p className="text-gray-400 text-xs mt-1">{job.type}</p>
        <div className="flex gap-2 mt-3">
          <button className="flex-1 bg-[#00d4ff] text-[#0a1628] text-[11px] font-bold py-2 rounded-lg">
            Navigate
          </button>
          <button className="flex-1 border border-[#1e3a5f] text-white text-[11px] font-bold py-2 rounded-lg">
            Start Job
          </button>
        </div>
      </div>
    ))}

    <div className="text-center text-[10px] text-gray-500 pt-2">
      Techs use this on their phone · Auto-text customer when 10 min away
    </div>
  </div>
);

export default FieldDeskDemo;

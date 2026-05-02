import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useNavigate } from "react-router-dom";

const DEMO_LEADS = [
  { score: 9, signal: "Pest Control Signal A", address: "14823 Woodward Ave", city: "Detroit", zip: "48203", detail: "Sample signal detail for demo purposes. This is what real leads look like.", opener: "Hi, we noticed activity at your property that suggests you may need pest control services soon." },
  { score: 7, signal: "Pest Control Signal B", address: "2201 Pontiac Lake Rd", city: "Waterford", zip: "48328", detail: "Second sample signal — different trigger, same exclusive data source.", opener: "We've been helping neighbors on your street — wanted to reach out before you had to search." },
  { score: 8, signal: "Pest Control Signal C", address: "38500 Van Dyke Ave", city: "Sterling Heights", zip: "48312", detail: "Third sample signal showing variety of trigger events we monitor.", opener: "Recent data in your ZIP suggests this may be the right time — happy to give you a free estimate." },
];

export default function PestControlRadarDemo() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0a1628] text-white">
      <nav className="border-b border-[#1e3a5f] px-6 py-4 flex items-center justify-between max-w-5xl mx-auto">
        <span className="text-[#00d4ff] font-bold text-sm tracking-widest uppercase">Detroit Web Agency</span>
        <Button onClick={() => navigate("/pest-control-radar")} size="sm" className="bg-[#00d4ff] text-[#0a1628] font-bold">
          Get Real Leads
        </Button>
      </nav>
      <div className="max-w-3xl mx-auto px-6 py-16">
        <Badge className="bg-[#00d4ff]/10 text-[#00d4ff] border-[#00d4ff]/30 mb-4">Sample Report · Demo Data</Badge>
        <h1 className="text-3xl font-extrabold mb-2">Pest Control Radar — Sample Lead Report</h1>
        <p className="text-[#94a3b8] mb-10">This is what your daily digest looks like. Real leads have actual homeowner addresses and AI-scored signals from public data sources.</p>
        <div className="space-y-4">
          {DEMO_LEADS.map((lead, i) => {
            const scoreColor = lead.score >= 9 ? "#00d4ff" : lead.score >= 7 ? "#fbbf24" : "#94a3b8";
            const q = encodeURIComponent(`${lead.address} ${lead.city} owner contact`);
            return (
              <div key={i} className="bg-[#0f2133] border border-[#1e3a5f] rounded-xl p-6">
                <div className="flex justify-between items-center mb-3">
                  <span style={{ color: scoreColor }} className="text-2xl font-extrabold">{lead.score}/10</span>
                  <span className="text-[#64748b] text-xs uppercase tracking-wide">{lead.signal}</span>
                </div>
                <p className="font-semibold mb-1">{lead.address}</p>
                <p className="text-[#94a3b8] text-sm mb-2">{lead.city}, MI {lead.zip}</p>
                <p className="text-[#cbd5e1] text-sm mb-3">{lead.detail}</p>
                <p className="text-[#e2e8f0] text-sm italic mb-4">"{lead.opener}"</p>
                <a href={`https://www.google.com/search?q=${q}`} target="_blank" rel="noreferrer"
                  className="inline-block px-3 py-1.5 bg-[#0a1628] text-[#00d4ff] border border-[#00d4ff] rounded text-xs">
                  🔍 Find Contact
                </a>
              </div>
            );
          })}
        </div>
        <div className="mt-12 text-center">
          <p className="text-[#94a3b8] mb-6">Ready for real leads in your ZIPs?</p>
          <Button onClick={() => navigate("/pest-control-radar")} className="bg-[#00d4ff] text-[#0a1628] font-bold text-lg px-8 py-3">
            Start 7-Day Free Trial →
          </Button>
        </div>
      </div>
    </div>
  );
}

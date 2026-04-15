import { useState } from "react";
import { Link } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { DollarSign, TrendingDown, Zap, ArrowRight, AlertTriangle } from "lucide-react";

export default function FreeLeakyBucketAudit() {
  const [leadsPerMonth, setLeadsPerMonth] = useState(40);
  const [costPerLead, setCostPerLead] = useState(55);
  const [closeRate, setCloseRate] = useState(12);
  const [email, setEmail] = useState("");
  const [captured, setCaptured] = useState(false);

  const annualSpend = leadsPerMonth * costPerLead * 12;
  const leadsWasted = Math.round(leadsPerMonth * (1 - closeRate / 100));
  const annualWaste = leadsWasted * costPerLead * 12;
  const recoverableRate = 0.15; // assume 15% of dead leads can be reactivated
  const recoverable = Math.round(annualWaste * recoverableRate);
  const wastePercent = annualSpend > 0 ? Math.round((annualWaste / annualSpend) * 100) : 0;

  const handleCapture = async () => {
    if (!email) return;
    setCaptured(true);
    await supabase.from("free_tool_leads" as any).insert({
      tool_name: "leaky_bucket_audit",
      email,
      input_data: { leadsPerMonth, costPerLead, closeRate },
      result_summary: `Annual waste: $${annualWaste.toLocaleString()}, Recoverable: $${recoverable.toLocaleString()}`,
    });
  };

  const severity = wastePercent >= 85 ? "CRITICAL" : wastePercent >= 70 ? "SEVERE" : wastePercent >= 50 ? "HIGH" : "MODERATE";
  const severityColor = wastePercent >= 85 ? "text-red-500" : wastePercent >= 70 ? "text-orange-500" : wastePercent >= 50 ? "text-amber-400" : "text-yellow-300";

  return (
    <>
      <SEOHead title="Free CRM Leak Calculator | Detroit Web Agency" description="Calculate how much revenue you're losing on dead leads every year — and how much you can recover with automated reactivation." path="/free-tools/leaky-bucket" />
      <div className="min-h-screen bg-[#0a0a0f] text-white">
        <div className="max-w-3xl mx-auto px-4 py-16">
          <Link to="/free-tools" className="text-cyan-400 text-xs font-mono hover:underline mb-6 inline-block">← All Free Tools</Link>

          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-500/10 text-red-400 text-[11px] font-bold tracking-widest uppercase font-mono mb-4">
              <TrendingDown size={12} /> Revenue Leak Calculator
            </div>
            <h1 className="text-3xl md:text-4xl font-black mb-3">How Much Are Dead Leads Costing You?</h1>
            <p className="text-[#888] max-w-xl mx-auto text-sm">Drag the sliders to match your business. The math is brutal — but the fix is simple.</p>
          </div>

          {/* Sliders */}
          <div className="space-y-8 mb-12 bg-white/[0.03] border border-white/10 rounded-2xl p-6">
            <div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-[#aaa]">Leads You Buy Per Month</span>
                <span className="font-bold text-cyan-400 font-mono">{leadsPerMonth}</span>
              </div>
              <Slider value={[leadsPerMonth]} onValueChange={([v]) => setLeadsPerMonth(v)} min={5} max={200} step={5} />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-[#aaa]">Cost Per Lead</span>
                <span className="font-bold text-cyan-400 font-mono">${costPerLead}</span>
              </div>
              <Slider value={[costPerLead]} onValueChange={([v]) => setCostPerLead(v)} min={5} max={150} step={5} />
            </div>
            <div>
              <div className="flex justify-between text-sm mb-3">
                <span className="text-[#aaa]">Your Close Rate</span>
                <span className="font-bold text-cyan-400 font-mono">{closeRate}%</span>
              </div>
              <Slider value={[closeRate]} onValueChange={([v]) => setCloseRate(v)} min={1} max={50} step={1} />
            </div>
          </div>

          {/* Results */}
          <div className="space-y-4 mb-8">
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6 text-center">
              <p className="text-[#888] text-xs uppercase tracking-widest mb-2">Annual Lead Spend</p>
              <p className="text-3xl font-black font-mono">${annualSpend.toLocaleString()}</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-red-500/5 border border-red-500/20 rounded-2xl p-5 text-center">
                <AlertTriangle className="text-red-500 mx-auto mb-2" size={20} />
                <p className="text-[#888] text-xs uppercase tracking-widest mb-1">Wasted on Dead Leads</p>
                <p className="text-2xl font-black text-red-400 font-mono">${annualWaste.toLocaleString()}</p>
                <p className="text-xs text-red-400/60 mt-1">{leadsWasted} leads/mo × 12 months</p>
              </div>
              <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5 text-center">
                <Zap className="text-emerald-400 mx-auto mb-2" size={20} />
                <p className="text-[#888] text-xs uppercase tracking-widest mb-1">Recoverable Revenue</p>
                <p className="text-2xl font-black text-emerald-400 font-mono">${recoverable.toLocaleString()}</p>
                <p className="text-xs text-emerald-400/60 mt-1">15% reactivation rate</p>
              </div>
            </div>

            {/* Waste bar */}
            <div className="bg-white/[0.03] border border-white/10 rounded-2xl p-6">
              <div className="flex justify-between items-center mb-3">
                <span className="text-sm text-[#aaa]">Revenue Leak Severity</span>
                <span className={`text-sm font-black font-mono ${severityColor}`}>{severity} — {wastePercent}%</span>
              </div>
              <div className="w-full h-4 bg-white/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-red-600 to-red-400 rounded-full transition-all duration-500" style={{ width: `${Math.min(wastePercent, 100)}%` }} />
              </div>
            </div>
          </div>

          {/* Lead Capture + CTA */}
          {!captured ? (
            <div className="bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-400/20 rounded-2xl p-6 text-center">
              <DollarSign className="text-cyan-400 mx-auto mb-3" size={28} />
              <h3 className="text-lg font-bold mb-2">Stop Burning Money on Dead Leads</h3>
              <p className="text-sm text-[#888] mb-4">Our SMS Reactivation Engine turns your dead HomeAdvisor, Angi, and Thumbtack leads into booked jobs. Enter your email for a free strategy call.</p>
              <div className="flex gap-2 max-w-md mx-auto">
                <Input type="email" placeholder="your@business.com" value={email} onChange={e => setEmail(e.target.value)} className="flex-1 bg-white/5 border-white/10" />
                <Button onClick={handleCapture} className="bg-cyan-500 hover:bg-cyan-600 text-black font-bold">Get My Fix</Button>
              </div>
            </div>
          ) : (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center">
              <Zap className="text-emerald-400 mx-auto mb-2" size={28} />
              <h3 className="text-lg font-bold mb-2">We'll Be In Touch</h3>
              <p className="text-sm text-[#888] mb-4">We'll show you exactly how to turn ${annualWaste.toLocaleString()} in dead leads into booked revenue.</p>
              <Link to="/dead-lead-intake" className="inline-flex items-center gap-2 text-cyan-400 font-bold text-sm hover:underline">
                Start Reactivating Now <ArrowRight size={14} />
              </Link>
            </div>
          )}

          <p className="text-center text-[10px] text-[#444] mt-8">Generated by Detroit Web Agency — detroitwebagent.com</p>
        </div>
      </div>
    </>
  );
}

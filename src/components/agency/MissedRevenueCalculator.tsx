import { useState } from "react";
import { Link } from "react-router-dom";
import { DollarSign, PhoneOff, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

const MissedRevenueCalculator = () => {
  const [missedCalls, setMissedCalls] = useState(5);
  const [ticketSize, setTicketSize] = useState(500);

  const weeklyLoss = missedCalls * ticketSize;
  const monthlyLoss = weeklyLoss * 4;
  const annualLoss = weeklyLoss * 52;

  const fmt = (n: number) =>
    n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

  return (
    <section className="py-20" style={{ background: "#0d1117", borderTop: "1px solid rgba(148,163,184,0.06)", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
      <div className="container max-w-4xl mx-auto px-4">
        <div className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-bold uppercase tracking-[0.2em] mb-6" style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171" }}>
            <PhoneOff className="h-3.5 w-3.5" /> The Problem
          </div>
          <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-3" style={{ color: "#f1f5f9" }}>
            How Much Revenue Are You Losing?
          </h2>
          <p style={{ color: "#64748b" }}>Every missed call is a job going to your competitor.</p>
        </div>

        <div className="rounded-2xl p-8 md:p-10" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid rgba(148,163,184,0.08)" }}>
          {/* Missed Calls Slider */}
          <div className="mb-8">
            <div className="flex justify-between mb-3">
              <label className="text-sm font-semibold" style={{ color: "#cbd5e1" }}>Missed Calls Per Week</label>
              <span className="text-sm font-bold" style={{ color: "#22d3ee" }}>{missedCalls}</span>
            </div>
            <input
              type="range" min={1} max={20} value={missedCalls}
              onChange={(e) => setMissedCalls(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, #22d3ee 0%, #22d3ee ${(missedCalls / 20) * 100}%, rgba(148,163,184,0.15) ${(missedCalls / 20) * 100}%, rgba(148,163,184,0.15) 100%)` }}
            />
          </div>

          {/* Ticket Size Slider */}
          <div className="mb-10">
            <div className="flex justify-between mb-3">
              <label className="text-sm font-semibold" style={{ color: "#cbd5e1" }}>Average Ticket Size</label>
              <span className="text-sm font-bold" style={{ color: "#22d3ee" }}>{fmt(ticketSize)}</span>
            </div>
            <input
              type="range" min={100} max={5000} step={50} value={ticketSize}
              onChange={(e) => setTicketSize(Number(e.target.value))}
              className="w-full h-2 rounded-full appearance-none cursor-pointer"
              style={{ background: `linear-gradient(to right, #22d3ee 0%, #22d3ee ${((ticketSize - 100) / 4900) * 100}%, rgba(148,163,184,0.15) ${((ticketSize - 100) / 4900) * 100}%, rgba(148,163,184,0.15) 100%)` }}
            />
          </div>

          {/* Results */}
          <div className="grid grid-cols-3 gap-4 mb-8">
            {[
              { label: "Weekly Loss", value: weeklyLoss },
              { label: "Monthly Loss", value: monthlyLoss },
              { label: "Annual Loss", value: annualLoss },
            ].map((item) => (
              <div key={item.label} className="text-center p-4 rounded-xl" style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.15)" }}>
                <div className="text-2xl md:text-3xl font-black" style={{ color: "#f87171" }}>{fmt(item.value)}</div>
                <div className="text-[10px] font-bold uppercase tracking-[0.15em] mt-1" style={{ color: "#94a3b8" }}>{item.label}</div>
              </div>
            ))}
          </div>

          <div className="text-center">
            <Button asChild size="lg" className="px-10 py-6 text-base font-bold rounded-lg" style={{ background: "linear-gradient(135deg, #06b6d4, #22d3ee)", color: "#020617", boxShadow: "0 0 30px rgba(6,182,212,0.3)" }}>
              <Link to="/ai-phone-answering">
                <DollarSign className="mr-2 h-4 w-4" /> Plug the Leak <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
};

export default MissedRevenueCalculator;

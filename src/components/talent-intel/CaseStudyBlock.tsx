import { Quote } from "lucide-react";

/**
 * Composite case study — anonymized outcomes only.
 * Per project memory: never expose data sources or methodology to clients.
 */
export default function CaseStudyBlock() {
  return (
    <div className="grid md:grid-cols-2 gap-4">
      <div className="bg-[#0f1f35] border border-white/10 rounded-2xl p-6">
        <Quote className="w-6 h-6 text-[#00d4ff]/40 mb-3" />
        <p className="text-slate-200 text-sm leading-relaxed mb-4">
          A Metro Detroit industrial staffing firm placed a 1st Class Boiler Operator in 11 days using our pre-market feed.
          The candidate had not yet posted a resume on any job board.
        </p>
        <div className="border-t border-white/10 pt-3 flex items-center justify-between">
          <div>
            <div className="text-white font-bold text-sm">Industrial · Wayne County</div>
            <div className="text-slate-500 text-xs">Placement: 11 days · 4 interviews booked</div>
          </div>
          <div className="text-right">
            <div className="text-[#00d4ff] font-bold text-lg">$14,400</div>
            <div className="text-slate-500 text-[10px] uppercase tracking-wider">commission</div>
          </div>
        </div>
      </div>

      <div className="bg-[#0f1f35] border border-white/10 rounded-2xl p-6">
        <Quote className="w-6 h-6 text-[#00d4ff]/40 mb-3" />
        <p className="text-slate-200 text-sm leading-relaxed mb-4">
          A healthcare staffing director filled three CNA roles for a skilled nursing facility in 9 days.
          All three candidates were flagged before they appeared on Indeed or LinkedIn.
        </p>
        <div className="border-t border-white/10 pt-3 flex items-center justify-between">
          <div>
            <div className="text-white font-bold text-sm">Healthcare · Oakland County</div>
            <div className="text-slate-500 text-xs">3 placements · 9 days · 7 interviews</div>
          </div>
          <div className="text-right">
            <div className="text-[#00d4ff] font-bold text-lg">$22,800</div>
            <div className="text-slate-500 text-[10px] uppercase tracking-wider">total fees</div>
          </div>
        </div>
      </div>
    </div>
  );
}

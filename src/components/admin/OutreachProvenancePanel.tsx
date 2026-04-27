import { useState } from "react";
import { Database, ChevronDown, ChevronUp, ShieldCheck, AlertTriangle } from "lucide-react";

export default function OutreachProvenancePanel() {
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-gradient-to-br from-emerald-950/30 to-slate-900/50 border border-emerald-700/30 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-3 hover:bg-emerald-900/10 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Database size={15} className="text-emerald-400" />
          <span className="text-xs font-bold text-emerald-200 uppercase tracking-widest">Are these real contacts? · How we get them</span>
        </div>
        {open ? <ChevronUp size={14} className="text-emerald-400" /> : <ChevronDown size={14} className="text-emerald-400" />}
      </button>

      {open && (
        <div className="p-4 pt-0 space-y-4 text-xs text-slate-300 leading-relaxed">
          <div className="border-t border-emerald-700/20 pt-3">
            <p className="text-slate-400 mb-2">
              <b className="text-emerald-300">Short version:</b> business names + phones come from real Google Maps listings.
              Emails are <i>discovered</i> through a 6-stage waterfall — some are provider-verified, others are educated guesses (clearly labeled).
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="bg-slate-900/50 border border-emerald-700/20 rounded p-3">
              <h4 className="text-emerald-300 font-bold mb-2 text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                <ShieldCheck size={12} /> Verified
              </h4>
              <ul className="space-y-1.5">
                <li><b className="text-white">Snov / Apollo / Hunter / PDL</b> — provider returns deliverability score + role match. Email shows in <span className="text-emerald-300">green</span>.</li>
                <li><b className="text-white">Google Maps phone</b> — pulled from the verified Google Business Profile.</li>
              </ul>
            </div>

            <div className="bg-slate-900/50 border border-amber-700/20 rounded p-3">
              <h4 className="text-amber-300 font-bold mb-2 text-[11px] uppercase tracking-wide flex items-center gap-1.5">
                <AlertTriangle size={12} /> Educated guess
              </h4>
              <ul className="space-y-1.5">
                <li><b className="text-white">Pattern-verify</b> — guesses common patterns (info@, owner@) and SMTP-pings the domain. Shows the <code className="text-[10px] bg-black/40 px-1 rounded">guess</code> chip.</li>
                <li><b className="text-white">Site scrape</b> — found on the contractor's website contact/about page. Shows the <code className="text-[10px] bg-black/40 px-1 rounded">guess</code> chip.</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-emerald-700/20 pt-3">
            <h4 className="text-emerald-300 font-bold mb-2 text-[11px] uppercase tracking-wide">Best practice</h4>
            <ul className="space-y-1 list-disc list-inside text-slate-400">
              <li>Trust <span className="text-emerald-300">verified</span> emails for outreach — bounce rate &lt; 5%.</li>
              <li>Treat <span className="text-amber-300">guess</span> emails as "send 1-2 only" — higher bounce risk hurts sender reputation.</li>
              <li>Click <b>Audit</b> on any prospect row to see the exact provider trace (which stages were tried, what each returned).</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from "react";
import { Info, ChevronDown, ChevronUp } from "lucide-react";

export default function ContractorLeadsInfoBox() {
  const [open, setOpen] = useState(true);

  return (
    <div className="bg-gradient-to-br from-slate-900/80 to-blue-950/40 border border-blue-500/30 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between p-4 hover:bg-blue-900/10 transition-colors"
      >
        <div className="flex items-center gap-3">
          <Info size={18} className="text-blue-400" />
          <h3 className="text-sm font-bold text-blue-200">📖 How This Tab Works (read me first)</h3>
        </div>
        {open ? <ChevronUp size={16} className="text-blue-400" /> : <ChevronDown size={16} className="text-blue-400" />}
      </button>

      {open && (
        <div className="p-5 pt-0 space-y-5 text-sm text-slate-300 leading-relaxed">
          <div className="border-t border-blue-500/20 pt-4">
            <h4 className="text-blue-300 font-bold mb-2 text-xs uppercase tracking-widest">Step-by-step</h4>
            <ol className="space-y-2 list-decimal list-inside">
              <li><b className="text-white">Add a territory</b> (Trade + City) using the <code className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded">+ Add</code> button in Territory Status.</li>
              <li><b className="text-white">Get contractors signed up</b> — either via the public sales page, or use the new <b className="text-cyan-300">Contractor Outreach</b> panel below to scrape + cold-email them.</li>
              <li><b className="text-white">Wire FB Page ID</b> on each territory so Facebook lead-form ads route automatically (optional — only if the contractor runs FB ads).</li>
              <li><b className="text-white">Leads come in</b> 3 ways: SEO landing pages, Facebook ads (if wired), or you adding them manually.</li>
              <li><b className="text-white">Each lead auto-SMSes</b> the contractor who owns that territory (within 30s).</li>
              <li><b className="text-white">Unclaimed lead?</b> Hit <code className="text-[10px] bg-black/40 px-1.5 py-0.5 rounded">Sell</code> in the Live Lead Feed to blast it to your contractor outreach list.</li>
              <li><b className="text-white">Action Queue</b> shows you what needs your attention (stuck leads, empty priority territories, new trial calls).</li>
            </ol>
          </div>

          <div className="border-t border-blue-500/20 pt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="text-blue-300 font-bold mb-2 text-xs uppercase tracking-widest">Live Lead Feed</h4>
              <ul className="space-y-1.5 text-xs">
                <li>🟢 <b>Delivered</b> — lead was SMS/emailed to a contractor</li>
                <li>🔴 <b>Stuck</b> — over 30 min old, no contractor to deliver to</li>
                <li>🟠 <b>DEMO</b> — fake seed data for screenshots; not a real homeowner</li>
                <li>💵 <b>Sell button</b> — opens à-la-carte sale (single contractor pays $39–99)</li>
              </ul>
            </div>
            <div>
              <h4 className="text-blue-300 font-bold mb-2 text-xs uppercase tracking-widest">Territory Status</h4>
              <ul className="space-y-1.5 text-xs">
                <li>🔒 <b>Locked (green)</b> — contractor assigned. Click <b>Unlock</b> to free it up.</li>
                <li>🔓 <b>Unlocked (amber)</b> — available, $399/mo unclaimed</li>
                <li>⚡ <b>Priority ring</b> — Matt's top-5 sell list (HVAC Warren, Plumbing Detroit, etc.)</li>
                <li><b>FB Page ID</b> — contractor's Facebook business page numeric ID. Find it at <code className="text-[10px] bg-black/40 px-1 rounded">facebook.com/[page]/about → Page Transparency</code>. Optional.</li>
              </ul>
            </div>
          </div>

          <div className="border-t border-blue-500/20 pt-4">
            <h4 className="text-blue-300 font-bold mb-2 text-xs uppercase tracking-widest">Cold outreach — what's legal?</h4>
            <ul className="space-y-1.5 text-xs">
              <li>✅ <b className="text-green-300">Cold EMAIL to contractors</b> — legal under CAN-SPAM (we include physical address + 1-click unsubscribe).</li>
              <li>⚠️ <b className="text-amber-300">Cold SMS to contractors</b> — risky under TCPA / 10DLC. Carriers will throttle and you can be fined.</li>
              <li>✅ <b className="text-green-300">SMS after consent</b> — legal once they reply or click. We track <code className="text-[10px] bg-black/40 px-1 rounded">consent_for_sms</code> on every prospect.</li>
              <li><b>Best play:</b> cold-email lead offers → reply/click = consent → then SMS the next ones.</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

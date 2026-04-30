import { useEffect, useMemo, useState } from "react";

type Props = {
  trade: string;
  geo: string;
  avgJobValue: number;
  defaultLeads?: number;
  replyRatePct?: number;
  costPerReply?: number;
  closeRatePct?: number;
};

const fmt = (n: number) => `$${Math.round(n).toLocaleString()}`;

export default function DeadLeadROICalculator({
  trade,
  geo,
  avgJobValue,
  defaultLeads = 350,
  replyRatePct = 6,
  costPerReply = 50,
  closeRatePct = 33,
}: Props) {
  const storageKey = `dl_roi_${trade.toLowerCase()}_${geo.toLowerCase()}`;
  const [leads, setLeads] = useState<number>(defaultLeads);

  useEffect(() => {
    try {
      const v = localStorage.getItem(storageKey);
      if (v) {
        const n = parseInt(v, 10);
        if (!Number.isNaN(n) && n >= 50 && n <= 2000) setLeads(n);
      }
    } catch { /* noop */ }
  }, [storageKey]);

  useEffect(() => {
    try { localStorage.setItem(storageKey, String(leads)); } catch { /* noop */ }
  }, [leads, storageKey]);

  const { replies, closes, revenue, cost, roi } = useMemo(() => {
    const replies = Math.round((leads * replyRatePct) / 100);
    const closes = Math.max(1, Math.round((replies * closeRatePct) / 100));
    const revenue = closes * avgJobValue;
    const cost = replies * costPerReply;
    const roi = cost > 0 ? Math.round(revenue / cost) : 0;
    return { replies, closes, revenue, cost, roi };
  }, [leads, replyRatePct, closeRatePct, avgJobValue, costPerReply]);

  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8">
      <div className="flex items-center justify-between mb-1">
        <p className="text-white/50 text-xs font-bold uppercase tracking-widest">
          Your ROI Calculator
        </p>
        <span className="text-[#00d4ff] text-xs font-semibold">{trade} · {geo}</span>
      </div>
      <h3 className="text-white text-xl sm:text-2xl font-black mb-5">
        How many old leads are sitting in your CRM?
      </h3>

      <div className="mb-2 flex items-baseline justify-between">
        <span className="text-white/60 text-sm">Old contacts</span>
        <span className="text-[#00d4ff] text-3xl font-black tabular-nums">
          {leads.toLocaleString()}
        </span>
      </div>
      <input
        type="range"
        min={50}
        max={2000}
        step={10}
        value={leads}
        onChange={(e) => setLeads(parseInt(e.target.value, 10))}
        className="w-full accent-[#00d4ff] cursor-pointer"
        aria-label="Number of old leads"
      />
      <div className="flex justify-between text-white/30 text-[10px] mt-1 mb-6">
        <span>50</span><span>500</span><span>1,000</span><span>2,000</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Stat label={`Replies (${replyRatePct}%)`} value={replies.toLocaleString()} />
        <Stat label={`Closed jobs (${closeRatePct}% of replies)`} value={closes.toLocaleString()} />
        <Stat label="Revenue potential" value={fmt(revenue)} highlight />
        <Stat label="Your cost @ $50/reply" value={fmt(cost)} />
      </div>

      <p className="text-center text-white/50 text-sm mt-5">
        Net upside: <strong className="text-white">{fmt(revenue - cost)}</strong> ·{" "}
        <strong className="text-[#00d4ff]">{roi}x ROI</strong>
      </p>
      <p className="text-center text-white/30 text-xs mt-2">
        First batch starts within 24–48h of your $1 pilot. Pause or cancel anytime.
      </p>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div
      className={
        "rounded-xl p-3 text-center border " +
        (highlight ? "bg-[#00d4ff]/10 border-[#00d4ff]/40" : "bg-white/5 border-white/10")
      }
    >
      <p className={"text-lg font-black tabular-nums " + (highlight ? "text-[#00d4ff]" : "text-white")}>
        {value}
      </p>
      <p className="text-white/40 text-[10px] leading-tight mt-1">{label}</p>
    </div>
  );
}

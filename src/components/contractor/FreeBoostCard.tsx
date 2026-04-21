import { Link } from "react-router-dom";

interface Props {
  contractorId: string;
  used: number;
  quota: number;
}

export default function FreeBoostCard({ contractorId, used, quota }: Props) {
  const remaining = Math.max(0, quota - used);
  const pct = Math.min(100, Math.round((used / quota) * 100));

  return (
    <section className="bg-gradient-to-br from-[#0d1f3c] to-[#0a1f30] border border-[#00d4ff]/30 rounded-xl p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div>
          <div className="text-[#00d4ff] text-xs uppercase tracking-wider font-bold">🎁 Free Boost Gift</div>
          <h2 className="text-lg font-bold mt-1">{remaining} free dead-lead reactivations left</h2>
        </div>
        <div className="text-right">
          <div className="text-2xl font-black text-[#00d4ff]">{used}/{quota}</div>
          <div className="text-white/40 text-xs">used</div>
        </div>
      </div>

      <div className="w-full h-2 bg-[#0a1628] rounded-full overflow-hidden mb-3">
        <div className="h-full bg-gradient-to-r from-[#00d4ff] to-[#0099cc] transition-all" style={{ width: `${pct}%` }} />
      </div>

      <p className="text-white/60 text-sm mb-3">
        Paste your old quotes — we SMS them on your behalf. Industry avg ~12% reply rate. Zero cost while you have free credits.
      </p>

      {remaining > 0 ? (
        <Link
          to={`/dead-lead-intake?cid=${contractorId}`}
          className="inline-block bg-[#00d4ff] text-[#0a1628] font-bold py-2 px-4 rounded text-sm"
        >
          Add Dead Leads →
        </Link>
      ) : (
        <p className="text-white/50 text-xs">Free quota used. After this, $50 charged only when a lead replies YES.</p>
      )}
    </section>
  );
}

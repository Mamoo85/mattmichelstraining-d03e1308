import { Sparkles, ExternalLink } from "lucide-react";

type Props = {
  productName: string;
  checklist: string[];
  etaText: string;
  setupGuideHref?: string;
};

/** Friendly empty state for product portals before any data has populated. */
export default function EmptyDashboardState({ productName, checklist, etaText, setupGuideHref }: Props) {
  return (
    <div className="rounded-2xl border border-[#1e3a5f] bg-[#0a1628] p-8 text-center max-w-2xl mx-auto">
      <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-[#00d4ff]/15 mb-4">
        <Sparkles className="text-[#00d4ff]" />
      </div>
      <h2 className="text-2xl font-bold text-white mb-2">Your {productName} is warming up</h2>
      <p className="text-white/60 mb-6">{etaText}</p>

      <ul className="text-left max-w-md mx-auto space-y-2 mb-6">
        {checklist.map((c, i) => (
          <li key={i} className="flex items-start gap-2 text-white/80 text-sm">
            <span className="text-[#00d4ff] mt-0.5">✓</span>
            <span>{c}</span>
          </li>
        ))}
      </ul>

      {setupGuideHref && (
        <a
          href={setupGuideHref}
          className="inline-flex items-center gap-2 text-[#00d4ff] hover:text-white text-sm font-semibold"
        >
          Setup guide <ExternalLink size={14} />
        </a>
      )}
    </div>
  );
}

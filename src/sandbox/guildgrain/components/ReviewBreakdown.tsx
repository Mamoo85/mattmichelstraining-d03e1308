import { seededReviews } from "../state/seededRandom";

export default function ReviewBreakdown({ productId }: { productId: string }) {
  const r = seededReviews(productId);
  const max = Math.max(...Object.values(r.buckets));
  return (
    <div className="gg-card p-5" data-testid="gg-reviews">
      <div className="flex items-baseline gap-3">
        <span className="gg-serif text-4xl">{r.avg.toFixed(1)}</span>
        <span className="text-sm text-[var(--gg-mute)]">{r.count.toLocaleString()} reviews</span>
      </div>
      <ul className="mt-4 space-y-1.5">
        {[5, 4, 3, 2, 1].map((star) => {
          const count = r.buckets[star as keyof typeof r.buckets];
          const pct = max ? (count / max) * 100 : 0;
          return (
            <li key={star} className="flex items-center gap-3 text-sm">
              <span className="w-8 text-[var(--gg-mute)]">{star}★</span>
              <div className="h-2 flex-1 bg-[var(--gg-cream-2)]">
                <div className="h-full bg-[var(--gg-forest)]" style={{ width: `${pct}%` }} />
              </div>
              <span className="w-12 text-right text-xs text-[var(--gg-mute)]">{count}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

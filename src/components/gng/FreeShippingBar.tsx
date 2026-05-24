// Sticky bottom-of-page progress bar nudging shoppers toward the free-shipping threshold.
// Reads a cart subtotal from props (parents that have a cart pass it in). Hidden at $0 and
// celebratory at/above threshold. Pure presentation — does not mutate any cart state.
import { useMemo } from "react";
import { Truck } from "lucide-react";

export function FreeShippingBar({ subtotalCents, thresholdCents = 5000 }: { subtotalCents: number; thresholdCents?: number }) {
  const { pct, remaining, unlocked } = useMemo(() => {
    const p = Math.min(100, (subtotalCents / thresholdCents) * 100);
    return {
      pct: p,
      remaining: Math.max(0, thresholdCents - subtotalCents),
      unlocked: subtotalCents >= thresholdCents,
    };
  }, [subtotalCents, thresholdCents]);

  if (subtotalCents <= 0) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40 bg-[#fdf6ec] border-t border-[#e8d8c0] shadow-[0_-4px_12px_rgba(0,0,0,0.04)]">
      <div className="max-w-4xl mx-auto px-4 py-3">
        <div className="flex items-center gap-3 mb-2">
          <Truck className="w-4 h-4 text-[#7a3e1d] shrink-0" />
          <p className="text-sm text-[#3d2a1a] font-medium">
            {unlocked
              ? "🎉 You unlocked free US shipping!"
              : <>Add <strong>${(remaining / 100).toFixed(2)}</strong> more for free US shipping</>}
          </p>
        </div>
        <div className="h-2 bg-[#e8d8c0] rounded-full overflow-hidden">
          <div
            className="h-full bg-[#7a3e1d] transition-all duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  className?: string;
  /** Number of founder seats remaining (optional — adds urgency if shown) */
  seatsRemaining?: number;
  /** Total founder seats (defaults to 25) */
  totalSeats?: number;
  /** Founder price label, e.g. "$99/mo" */
  price?: string;
  /** Standard price label, e.g. "$149/mo" */
  standardPrice?: string;
}

/**
 * Founder Pricing Lock-In Badge — drop on any radar landing page.
 * Scarcity + price-anchor + permanent-lock messaging in one component.
 */
export function FounderPricingBadge({
  className,
  seatsRemaining,
  totalSeats = 25,
  price,
  standardPrice,
}: Props) {
  const showScarcity = typeof seatsRemaining === "number" && seatsRemaining > 0;

  return (
    <div
      className={cn(
        "inline-flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 px-4 py-2.5 rounded-lg",
        "bg-gradient-to-r from-amber-500/10 via-amber-500/15 to-amber-500/10",
        "border border-amber-500/40 shadow-[0_0_20px_-5px_rgba(245,158,11,0.4)]",
        className
      )}
    >
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
        <span className="text-xs font-bold uppercase tracking-wider text-amber-300">Founder Pricing</span>
      </div>
      <div className="flex items-center gap-2 text-sm">
        {price && (
          <>
            <span className="font-bold text-foreground">{price}</span>
            {standardPrice && (
              <span className="text-muted-foreground line-through text-xs">{standardPrice}</span>
            )}
            <span className="text-amber-300/80">·</span>
          </>
        )}
        <span className="text-amber-200/90">Locked in forever</span>
        {showScarcity && (
          <>
            <span className="text-amber-300/80">·</span>
            <span className="font-semibold text-amber-300">
              {seatsRemaining}/{totalSeats} seats left
            </span>
          </>
        )}
      </div>
    </div>
  );
}

export default FounderPricingBadge;

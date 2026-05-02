/**
 * Wave A3 — LockedPriceBadge
 *
 * Visual proof of the Forever Pricing promise. Shows the client's locked
 * monthly price + lock date and reveals the carve-out clause on hover/tap.
 *
 * Reads from `client_price_locks` filtered by the current authenticated
 * user's email (RLS does the rest). Falls back to a static "Locked" pill
 * when the user isn't signed in (lets us show the badge on marketing pages
 * with a placeholder price).
 */
import { useEffect, useState } from "react";
import { Lock, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface PriceLock {
  locked_price_cents: number;
  tier: string;
  locked_at: string;
  carve_out_clause: string;
  lock_version: string;
}

interface Props {
  /** Optional — render this price/tier if the user has no lock record yet (marketing pages). */
  fallbackPriceCents?: number;
  fallbackTier?: string;
  className?: string;
  variant?: "default" | "compact" | "hero";
}

const formatPrice = (cents: number) => `$${(cents / 100).toLocaleString()}/mo`;

export function LockedPriceBadge({
  fallbackPriceCents,
  fallbackTier,
  className,
  variant = "default",
}: Props) {
  const [lock, setLock] = useState<PriceLock | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData?.user) {
        if (!cancelled) setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from("client_price_locks")
        .select("locked_price_cents, tier, locked_at, carve_out_clause, lock_version")
        .order("locked_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cancelled) {
        if (!error && data) setLock(data as PriceLock);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return null;

  const priceCents = lock?.locked_price_cents ?? fallbackPriceCents;
  const tier = lock?.tier ?? fallbackTier;
  if (!priceCents) return null;

  const lockedSince = lock
    ? `Locked ${new Date(lock.locked_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
    : "Forever Pricing";
  const carveOut =
    lock?.carve_out_clause ||
    "Forever Pricing covers the v1 feature set plus every monthly improvement. Net-new product lines released after 24 months are opt-in at then-current rates.";

  const sizeClasses = {
    compact: "px-3 py-1.5 text-xs",
    default: "px-4 py-2 text-sm",
    hero: "px-6 py-3 text-base",
  }[variant];

  return (
    <TooltipProvider delayDuration={120}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-full border-2 font-bold tracking-tight cursor-help transition-all",
              "border-primary bg-primary/10 text-primary hover:bg-primary/20",
              sizeClasses,
              className,
            )}
            role="status"
            aria-label={`Price locked at ${formatPrice(priceCents)} forever`}
          >
            <Lock className="h-4 w-4 shrink-0" aria-hidden />
            <span className="font-black">{formatPrice(priceCents)}</span>
            <span className="opacity-70 font-medium">·</span>
            <span className="uppercase text-[0.7em] tracking-widest font-extrabold">Locked Forever</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs text-xs leading-relaxed p-3">
          <div className="flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 mt-0.5 shrink-0 text-primary" aria-hidden />
            <div>
              <p className="font-semibold mb-1">{lockedSince}{tier ? ` · ${tier}` : ""}</p>
              <p className="opacity-90">{carveOut}</p>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default LockedPriceBadge;

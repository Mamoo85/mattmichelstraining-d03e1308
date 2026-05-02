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
  locked_monthly_price: number;
  product: string;
  locked_since: string;
  notes: string | null;
}

interface Props {
  /** Optional — render this price/tier if the user has no lock record yet (marketing pages). */
  fallbackPriceCents?: number;
  fallbackTier?: string;
  className?: string;
  variant?: "default" | "compact" | "hero";
  /** Optional — look up the lock by email instead of the authenticated user (owner dashboard / magic link). */
  clientEmail?: string;
}

const formatPrice = (cents: number) => `$${(cents / 100).toLocaleString()}/mo`;
const formatDollars = (dollars: number) => `$${Number(dollars).toLocaleString()}/mo`;

export function LockedPriceBadge({
  fallbackPriceCents,
  fallbackTier,
  className,
  variant = "default",
  clientEmail,
}: Props) {
  const [lock, setLock] = useState<PriceLock | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      let query = supabase
        .from("client_price_locks" as any)
        .select("locked_monthly_price, product, locked_since, notes")
        .eq("active", true);

      if (clientEmail) {
        query = query.eq("client_email", clientEmail.toLowerCase());
      } else {
        const { data: userData } = await supabase.auth.getUser();
        if (!userData?.user?.email) {
          if (!cancelled) setLoading(false);
          return;
        }
        query = query.eq("client_email", userData.user.email.toLowerCase());
      }

      const { data, error } = await query.order("locked_since", { ascending: false }).limit(1).maybeSingle();
      if (!cancelled) {
        if (!error && data) setLock(data as unknown as PriceLock);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [clientEmail]);

  if (loading) return null;

  const priceLabel = lock ? formatDollars(lock.locked_monthly_price) : (fallbackPriceCents ? formatPrice(fallbackPriceCents) : null);
  const tier = lock?.product ?? fallbackTier;
  if (!priceLabel) return null;

  const lockedSince = lock
    ? `Locked ${new Date(lock.locked_since).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}`
    : "Forever Pricing";
  const carveOut =
    lock?.notes ||
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
            aria-label={`Price locked at ${priceLabel} forever`}
          >
            <Lock className="h-4 w-4 shrink-0" aria-hidden />
            <span className="font-black">{priceLabel}</span>
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

/**
 * Shown when a customer lands on a token-gated portal directly from
 * Stripe checkout success (no token in URL yet — magic-link email is
 * still being sent). Pattern reused across all DWA portals.
 */
export default function JustPurchasedScreen({ product }: { product: string }) {
  return (
    <div className="min-h-screen bg-[#030711] text-foreground flex items-center justify-center px-4">
      <div className="bg-[#0a1628] border border-[#1e3a5f] rounded-xl p-8 text-center max-w-md w-full">
        <div className="text-5xl mb-3">🎉</div>
        <p className="text-white text-xl font-bold mb-2">Payment confirmed!</p>
        <p className="text-[#94a3b8] text-sm leading-relaxed mb-4">
          Your <strong className="text-white">{product}</strong> account is being activated. Check your email — we're sending you a one-click login link right now.
        </p>
        <p className="text-[#64748b] text-xs">
          Didn't get it? Text Matt at (313) 992-1219 and we'll sort it out in minutes.
        </p>
      </div>
    </div>
  );
}

export function isJustPurchased(): boolean {
  if (typeof window === "undefined") return false;
  const p = new URLSearchParams(window.location.search);
  return (
    p.get("trial") === "success" ||
    p.get("success") === "1" ||
    p.get("subscribed") === "1" ||
    !!p.get("session_id")
  );
}

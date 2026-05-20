import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useGGCart } from "../state/CartContext";
import { useState } from "react";
import { X, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function MiniCart() {
  const { lines, miniOpen, setMiniOpen, setQty, remove, subtotal, shipping, discount, total, coupon, applyCoupon, clearCoupon, couponLabel } = useGGCart();
  const [code, setCode] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const submitCoupon = () => {
    setErr(null);
    const e = applyCoupon(code);
    if (e) setErr(e);
    else { setCode(""); }
  };

  return (
    <Sheet open={miniOpen} onOpenChange={setMiniOpen}>
      <SheetContent side="right" className="gg-theme w-full max-w-md overflow-y-auto bg-[var(--gg-cream)] p-0" data-testid="gg-mini-cart">
        <SheetHeader className="border-b border-[var(--gg-line)] p-5">
          <SheetTitle className="gg-serif text-2xl">Your Cart</SheetTitle>
        </SheetHeader>
        <div className="p-5">
          {lines.length === 0 ? (
            <p className="py-10 text-center text-sm text-[var(--gg-mute)]">Your cart is empty. <Link to="/guild-grain/shop" className="underline" onClick={() => setMiniOpen(false)}>Shop the collection →</Link></p>
          ) : (
            <>
              <ul className="space-y-4">
                {lines.map((l) => (
                  <li key={l.key} className="flex gap-3 border-b border-[var(--gg-line)] pb-4" data-testid="gg-cart-line">
                    <img src={l.previewDataUrl || l.image} alt="" className="h-20 w-20 flex-shrink-0 object-cover" />
                    <div className="flex-1">
                      <p className="text-sm font-medium leading-tight">{l.title}</p>
                      {l.personalization?.text && (
                        <p className="mt-0.5 text-xs italic text-[var(--gg-mute)]">"{l.personalization.text}" · {l.personalization.material}</p>
                      )}
                      <div className="mt-2 flex items-center gap-2">
                        <button onClick={() => setQty(l.key, l.qty - 1)} className="h-7 w-7 border border-[var(--gg-line)] text-sm" aria-label="Decrease">−</button>
                        <span className="w-6 text-center text-sm">{l.qty}</span>
                        <button onClick={() => setQty(l.key, l.qty + 1)} className="h-7 w-7 border border-[var(--gg-line)] text-sm" aria-label="Increase">+</button>
                        <span className="ml-auto text-sm font-semibold">${(l.unitPrice * l.qty).toFixed(2)}</span>
                        <button onClick={() => remove(l.key)} className="ml-2 text-[var(--gg-mute)] hover:text-[var(--gg-clay)]" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>

              <div className="mt-5 border-t border-[var(--gg-line)] pt-5">
                {coupon ? (
                  <div className="mb-3 flex items-center justify-between bg-[var(--gg-cream-2)] px-3 py-2 text-sm">
                    <span><strong>{coupon}</strong> — {couponLabel}</span>
                    <button onClick={clearCoupon} className="text-[var(--gg-mute)]" aria-label="Remove coupon"><X className="h-4 w-4" /></button>
                  </div>
                ) : (
                  <div className="mb-3">
                    <div className="flex gap-2">
                      <input value={code} onChange={(e) => { setCode(e.target.value); setErr(null); }} placeholder="Promo code" className="gg-input flex-1" data-testid="gg-coupon-input" />
                      <button onClick={submitCoupon} className="gg-btn gg-btn--ghost" data-testid="gg-coupon-apply">Apply</button>
                    </div>
                    {err && <p className="mt-1.5 text-xs text-[var(--gg-clay-deep)]" data-testid="gg-coupon-err">{err}</p>}
                    <p className="mt-1.5 text-[11px] text-[var(--gg-mute)]">Try VOLUME10, GRAIN15, or FIRSTGIFT</p>
                  </div>
                )}

                <dl className="space-y-1 text-sm">
                  <div className="flex justify-between"><dt>Subtotal</dt><dd data-testid="gg-subtotal">${subtotal.toFixed(2)}</dd></div>
                  {discount > 0 && <div className="flex justify-between text-[var(--gg-clay-deep)]"><dt>Discount</dt><dd>−${discount.toFixed(2)}</dd></div>}
                  <div className="flex justify-between"><dt>Shipping</dt><dd>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</dd></div>
                  <div className="flex justify-between border-t border-[var(--gg-line)] pt-2 text-base font-semibold"><dt>Total</dt><dd data-testid="gg-total">${total.toFixed(2)}</dd></div>
                </dl>

                <Link to="/guild-grain/checkout" onClick={() => setMiniOpen(false)} className="gg-btn gg-btn--clay mt-5 w-full" data-testid="gg-checkout-btn">Checkout</Link>
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

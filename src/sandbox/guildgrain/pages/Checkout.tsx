import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useGGCart } from "../state/CartContext";
import { CheckCircle2 } from "lucide-react";

const STEPS = ["Shipping", "Payment", "Confirmation"] as const;

export default function GGCheckout() {
  const { lines, subtotal, shipping, discount, total, clear, couponLabel, coupon } = useGGCart();
  const [step, setStep] = useState<0 | 1 | 2>(0);
  const [ship, setShip] = useState({ name: "", email: "", address: "", city: "", zip: "" });
  const [pay, setPay] = useState({ card: "", exp: "", cvc: "" });
  const [orderId] = useState(() => "GG-" + Math.random().toString(36).slice(2, 8).toUpperCase());
  const nav = useNavigate();

  if (lines.length === 0 && step !== 2) {
    return (
      <div className="py-20 text-center">
        <h1 className="gg-serif text-3xl">Your cart is empty</h1>
        <button onClick={() => nav("/guild-grain/shop")} className="gg-btn gg-btn--clay mt-6">Shop the Collection</button>
      </div>
    );
  }

  const shipValid = ship.name && ship.email && ship.address && ship.city && ship.zip;
  const payValid = pay.card.length >= 12 && pay.exp.length >= 4 && pay.cvc.length >= 3;

  const onPlace = () => { setStep(2); clear(); };

  return (
    <div className="mx-auto max-w-3xl">
      <ol className="mb-8 flex items-center justify-center gap-2 text-xs uppercase tracking-[0.16em]">
        {STEPS.map((s, i) => (
          <li key={s} className="flex items-center gap-2">
            <span className={`flex h-7 w-7 items-center justify-center rounded-full border ${i <= step ? "border-[var(--gg-ink)] bg-[var(--gg-ink)] text-[var(--gg-cream)]" : "border-[var(--gg-line)] text-[var(--gg-mute)]"}`}>{i + 1}</span>
            <span className={i <= step ? "text-[var(--gg-ink)]" : "text-[var(--gg-mute)]"}>{s}</span>
            {i < 2 && <span className="ml-2 h-px w-8 bg-[var(--gg-line)]" />}
          </li>
        ))}
      </ol>

      {step === 0 && (
        <div className="gg-card p-6" data-testid="gg-step-shipping">
          <h2 className="gg-serif text-2xl">Shipping</h2>
          <div className="mt-4 grid gap-3">
            <input className="gg-input" placeholder="Full name" value={ship.name} onChange={(e) => setShip({ ...ship, name: e.target.value })} data-testid="gg-ship-name" />
            <input className="gg-input" placeholder="Email" type="email" value={ship.email} onChange={(e) => setShip({ ...ship, email: e.target.value })} data-testid="gg-ship-email" />
            <input className="gg-input" placeholder="Street address" value={ship.address} onChange={(e) => setShip({ ...ship, address: e.target.value })} data-testid="gg-ship-address" />
            <div className="grid grid-cols-2 gap-3">
              <input className="gg-input" placeholder="City" value={ship.city} onChange={(e) => setShip({ ...ship, city: e.target.value })} data-testid="gg-ship-city" />
              <input className="gg-input" placeholder="ZIP" value={ship.zip} onChange={(e) => setShip({ ...ship, zip: e.target.value })} data-testid="gg-ship-zip" />
            </div>
          </div>
          <button disabled={!shipValid} onClick={() => setStep(1)} className="gg-btn gg-btn--clay mt-5 disabled:opacity-40" data-testid="gg-ship-continue">Continue to Payment →</button>
        </div>
      )}

      {step === 1 && (
        <div className="gg-card p-6" data-testid="gg-step-payment">
          <h2 className="gg-serif text-2xl">Payment</h2>
          <p className="mt-1 text-xs text-[var(--gg-mute)]">Demo only — no real charge.</p>
          <div className="mt-4 grid gap-3">
            <input className="gg-input" placeholder="Card number" value={pay.card} onChange={(e) => setPay({ ...pay, card: e.target.value.replace(/[^0-9 ]/g, "") })} data-testid="gg-pay-card" />
            <div className="grid grid-cols-2 gap-3">
              <input className="gg-input" placeholder="MM/YY" value={pay.exp} onChange={(e) => setPay({ ...pay, exp: e.target.value })} data-testid="gg-pay-exp" />
              <input className="gg-input" placeholder="CVC" value={pay.cvc} onChange={(e) => setPay({ ...pay, cvc: e.target.value.replace(/[^0-9]/g, "") })} data-testid="gg-pay-cvc" />
            </div>
          </div>

          <dl className="mt-6 space-y-1 text-sm">
            <div className="flex justify-between"><dt>Subtotal</dt><dd>${subtotal.toFixed(2)}</dd></div>
            {discount > 0 && <div className="flex justify-between text-[var(--gg-clay-deep)]"><dt>{coupon} — {couponLabel}</dt><dd>−${discount.toFixed(2)}</dd></div>}
            <div className="flex justify-between"><dt>Shipping</dt><dd>{shipping === 0 ? "Free" : `$${shipping.toFixed(2)}`}</dd></div>
            <div className="flex justify-between border-t border-[var(--gg-line)] pt-2 text-base font-semibold"><dt>Total</dt><dd>${total.toFixed(2)}</dd></div>
          </dl>

          <div className="mt-5 flex gap-3">
            <button onClick={() => setStep(0)} className="gg-btn gg-btn--ghost">← Back</button>
            <button disabled={!payValid} onClick={onPlace} className="gg-btn gg-btn--clay disabled:opacity-40" data-testid="gg-place-order">Place Order — ${total.toFixed(2)}</button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="gg-card p-10 text-center" data-testid="gg-step-confirmation">
          <CheckCircle2 className="mx-auto h-14 w-14 text-[var(--gg-forest)]" />
          <h2 className="gg-serif mt-4 text-3xl">Order placed</h2>
          <p className="mt-2 text-sm text-[var(--gg-mute)]">Confirmation #{orderId} — we've emailed your receipt.</p>
          <p className="mt-1 text-xs text-[var(--gg-mute)]">Your artisan will begin crafting within 24 hours.</p>
          <button onClick={() => nav("/guild-grain")} className="gg-btn gg-btn--ghost mt-6">Continue Shopping</button>
        </div>
      )}
    </div>
  );
}

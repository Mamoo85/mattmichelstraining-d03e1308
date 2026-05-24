// Exit-intent modal that fires once per visitor (localStorage flag) when the cursor leaves
// the top of the viewport. Offers a 10% discount code (GNG10) and a CTA to the subscription
// page. Purely client-side — no backend coupling. Self-suppresses on mobile (no mouseleave).
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { X, Gift } from "lucide-react";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "gng_exit_intent_seen_v1";

export function ExitIntentPopup() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (window.matchMedia("(max-width: 768px)").matches) return; // no mouseleave on mobile

    let armed = true;
    const onMove = (e: MouseEvent) => {
      if (!armed) return;
      if (e.clientY <= 0) {
        armed = false;
        setOpen(true);
        localStorage.setItem(STORAGE_KEY, String(Date.now()));
      }
    };
    document.addEventListener("mouseout", onMove);
    return () => document.removeEventListener("mouseout", onMove);
  }, []);

  function copyCode() {
    navigator.clipboard?.writeText("GNG10").catch(() => {});
  }

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
      <div className="bg-[#fdf6ec] rounded-2xl max-w-md w-full p-8 relative shadow-2xl border border-[#e8d8c0]">
        <button
          onClick={() => setOpen(false)}
          aria-label="Close"
          className="absolute top-3 right-3 p-2 rounded-full hover:bg-[#e8d8c0] text-[#7a3e1d]"
        >
          <X className="w-4 h-4" />
        </button>
        <Gift className="w-10 h-10 text-[#7a3e1d] mb-4" />
        <h2 className="font-serif text-3xl font-bold text-[#3d2a1a] mb-2">Wait — here's 10% off.</h2>
        <p className="text-[#5b4636] mb-5">
          Use code <button onClick={copyCode} className="font-mono font-bold bg-[#7a3e1d] text-white px-2 py-1 rounded hover:bg-[#5b2e15]">GNG10</button> at checkout. Or start a monthly box and save even more.
        </p>
        <div className="flex gap-3">
          <Button onClick={() => setOpen(false)} variant="outline" className="flex-1 border-[#7a3e1d] text-[#7a3e1d] hover:bg-[#7a3e1d] hover:text-white">
            Keep shopping
          </Button>
          <Link to="/gng/subscriptions" className="flex-1" onClick={() => setOpen(false)}>
            <Button className="w-full bg-[#7a3e1d] hover:bg-[#5b2e15] text-white">See boxes →</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

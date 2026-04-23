/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  onLogin: (tech: { id: string; name: string; client_id: string }) => void;
}

export default function TechLogin({ onLogin }: Props) {
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(pinValue: string) {
    if (pinValue.length !== 4) { toast.error("Enter your 4-digit PIN"); return; }
    setLoading(true);
    const { data, error } = await supabase
      .rpc("verify_tech_pin", { _pin: pinValue })
      .maybeSingle();

    if (error || !data) {
      toast.error("Invalid PIN. Try again.");
      setPin("");
      setLoading(false);
      return;
    }
    onLogin(data);
    setLoading(false);
  }

  function tap(digit: string) {
    if (digit === "⌫") { setPin(p => p.slice(0, -1)); return; }
    if (pin.length >= 4) return;
    const next = pin + digit;
    setPin(next);
    if (next.length === 4) setTimeout(() => handleSubmit(next), 100);
  }

  const keys = ["1","2","3","4","5","6","7","8","9","","0","⌫"];

  return (
    <div className="min-h-screen bg-[#0a1628] flex flex-col items-center justify-center px-6">
      <div className="mb-2">
        <span className="font-black text-xl tracking-tight text-white">DETROIT</span>
        <span className="text-[#00d4ff] font-black text-xl tracking-tight"> WEB AGENCY</span>
      </div>
      <p className="text-white/40 text-xs mb-10">Field Service — Tech Login</p>

      {/* PIN dots */}
      <div className="flex gap-4 mb-10">
        {[0,1,2,3].map(i => (
          <div
            key={i}
            className={`w-4 h-4 rounded-full border-2 transition-all ${
              pin.length > i ? "bg-[#00d4ff] border-[#00d4ff]" : "bg-transparent border-white/30"
            }`}
          />
        ))}
      </div>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-3 w-64">
        {keys.map((k, i) => (
          <button
            key={i}
            onClick={() => k && tap(k)}
            disabled={loading || !k}
            className={`h-16 rounded-lg text-xl font-bold transition-all ${
              k
                ? "bg-white/10 text-white active:bg-[#00d4ff]/30 hover:bg-white/20"
                : "invisible"
            }`}
          >
            {k}
          </button>
        ))}
      </div>

      {loading && <p className="text-white/40 text-xs mt-6">Checking PIN...</p>}
    </div>
  );
}

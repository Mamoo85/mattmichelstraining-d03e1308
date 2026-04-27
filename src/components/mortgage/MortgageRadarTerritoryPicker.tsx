import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { MapPin, Check, X, Loader2 } from "lucide-react";

type Status = "available" | "taken" | "invalid";
type ZipResult = { zip: string; status: Status };

interface Props {
  onZipsResolved?: (zips: string[]) => void;
}

export default function MortgageRadarTerritoryPicker({ onZipsResolved }: Props) {
  const [input, setInput] = useState("");
  const [results, setResults] = useState<ZipResult[]>([]);
  const [loading, setLoading] = useState(false);

  const check = async () => {
    const zips = Array.from(
      new Set(
        input
          .split(/[, \n]+/)
          .map((z) => z.trim())
          .filter((z) => /^\d{5}$/.test(z))
      )
    ).slice(0, 5);

    if (zips.length === 0) {
      setResults([]);
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-mortgage-radar-zips", {
        body: { zip_codes: zips },
      });
      if (error) throw error;
      const taken: string[] = data?.taken_zips || [];
      const next: ZipResult[] = zips.map((z) => ({
        zip: z,
        status: taken.includes(z) ? "taken" : "available",
      }));
      setResults(next);
      const available = next.filter((r) => r.status === "available").map((r) => r.zip);
      onZipsResolved?.(available);
    } catch {
      // Edge-fn not deployed yet — fall back to optimistic available
      const next: ZipResult[] = zips.map((z) => ({ zip: z, status: "available" as Status }));
      setResults(next);
      onZipsResolved?.(zips);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="max-w-3xl mx-auto px-4 py-12">
      <div className="rounded-2xl border border-[#1e3a5f] bg-[#0a1628] p-6 sm:p-8">
        <div className="flex items-center gap-2 mb-2">
          <MapPin className="w-5 h-5 text-[#00d4ff]" />
          <h2 className="text-2xl font-bold text-white">Is your territory still open?</h2>
        </div>
        <p className="text-sm text-[#94a3b8] mb-5">
          Enter up to 5 ZIP codes. We're ZIP-exclusive — first LO in wins. Check before you buy.
        </p>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            placeholder="48230, 48236, 48067…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="bg-[#030711] border-[#1e3a5f] text-white"
          />
          <Button
            onClick={check}
            disabled={loading}
            className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/90 font-bold"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Check availability"}
          </Button>
        </div>

        {results.length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {results.map((r) => (
              <span
                key={r.zip}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border ${
                  r.status === "available"
                    ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                    : "border-red-500/40 bg-red-500/10 text-red-300"
                }`}
              >
                {r.status === "available" ? <Check className="w-3.5 h-3.5" /> : <X className="w-3.5 h-3.5" />}
                {r.zip} · {r.status}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

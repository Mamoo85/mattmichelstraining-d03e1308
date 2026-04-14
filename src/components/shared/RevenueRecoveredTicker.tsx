import { useEffect, useState } from "react";
import { DollarSign } from "lucide-react";

interface RevenueRecoveredTickerProps {
  contractorId?: string;
  roiToken?: string;
}

export default function RevenueRecoveredTicker({ contractorId, roiToken }: RevenueRecoveredTickerProps) {
  const [revenue, setRevenue] = useState<number | null>(null);
  const [animatedRevenue, setAnimatedRevenue] = useState(0);

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  useEffect(() => {
    async function fetchRevenue() {
      try {
        const params = roiToken ? `token=${roiToken}` : `contractor_id=${contractorId}`;
        const res = await fetch(`${baseUrl}/get-client-revenue-stats?${params}`, {
          headers: { apikey },
        });
        if (!res.ok) return;
        const data = await res.json();
        setRevenue(data.total_revenue_recovered || 0);
      } catch {
        // silent
      }
    }
    if (contractorId || roiToken) fetchRevenue();
  }, [contractorId, roiToken]);

  // Animate counter
  useEffect(() => {
    if (revenue === null || revenue === 0) return;
    const duration = 1500;
    const steps = 40;
    const increment = revenue / steps;
    let current = 0;
    const interval = setInterval(() => {
      current += increment;
      if (current >= revenue) {
        setAnimatedRevenue(revenue);
        clearInterval(interval);
      } else {
        setAnimatedRevenue(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(interval);
  }, [revenue]);

  if (revenue === null || revenue === 0) return null;

  return (
    <div className="relative overflow-hidden rounded-xl border border-emerald-500/30 bg-gradient-to-r from-emerald-950/50 via-emerald-900/30 to-emerald-950/50 p-5 mb-6">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/5 to-transparent" />
      <div className="relative flex items-center justify-center gap-3">
        <div className="h-10 w-10 rounded-full bg-emerald-500/20 flex items-center justify-center animate-pulse">
          <DollarSign className="h-5 w-5 text-emerald-400" />
        </div>
        <div className="text-center">
          <p className="text-[10px] font-bold text-emerald-400/70 uppercase tracking-[3px] mb-1">
            Total Revenue Recovered by DWA Systems
          </p>
          <p className="text-3xl md:text-4xl font-black text-emerald-400 tabular-nums">
            ${animatedRevenue.toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

import { useQuery } from "@tanstack/react-query";
import { DollarSign, TrendingUp } from "lucide-react";

interface RevenueRecoveredLedgerProps {
  token: string;
  clientType: "techalert" | "contractor";
}

export default function RevenueRecoveredLedger({ token, clientType }: RevenueRecoveredLedgerProps) {
  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const { data } = useQuery({
    queryKey: ["revenue-recovered", token, clientType],
    queryFn: async () => {
      const res = await fetch(
        `${baseUrl}/client-revenue-recovered?token=${token}&client_type=${clientType}`,
        { headers: { apikey } }
      );
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!token,
  });

  if (!data || !data.total_recovered_cents || data.total_recovered_cents === 0) return null;

  const dollars = Math.floor(data.total_recovered_cents / 100);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
      <DollarSign className="h-3.5 w-3.5 text-emerald-400" />
      <span className="text-xs font-bold text-emerald-400 tabular-nums">
        ${dollars.toLocaleString()}
      </span>
      <span className="text-[10px] text-emerald-400/60 hidden sm:inline">
        recovered via DWA · {data.period}
      </span>
      <TrendingUp className="h-3 w-3 text-emerald-500/50" />
    </div>
  );
}

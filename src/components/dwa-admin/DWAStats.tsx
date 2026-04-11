// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface StatCardProps {
  label: string;
  value: string | number;
  loading: boolean;
}

function StatCard({ label, value, loading }: StatCardProps) {
  return (
    <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-5 flex flex-col gap-1">
      <span className="text-2xl font-bold text-[#00d4ff]">
        {loading ? (
          <span className="inline-block w-12 h-7 bg-white/10 rounded animate-pulse" />
        ) : (
          value
        )}
      </span>
      <span className="text-sm text-white/50 uppercase tracking-wide">{label}</span>
    </div>
  );
}

export default function DWAStats() {
  const { data, isLoading } = useQuery({
    queryKey: ["dwa-stats"],
    queryFn: async () => {
      const [
        activeClientsRes,
        totalClientsRes,
        activePlansRes,
      ] = await Promise.all([
        supabase
          .from("field_crm_clients")
          .select("*", { count: "exact", head: true })
          .eq("status", "active"),
        supabase
          .from("field_crm_clients")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("field_crm_clients")
          .select("plan")
          .eq("status", "active"),
      ]);

      const mrr = (activePlansRes.data ?? []).reduce((sum, row) => {
        if (row.plan === "bundle") return sum + 199;
        if (row.plan === "standalone") return sum + 299;
        return sum;
      }, 0);

      return {
        activeClients: activeClientsRes.count ?? 0,
        totalClients: totalClientsRes.count ?? 0,
        mrr,
      };
    },
    staleTime: 60_000,
  });

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      <StatCard label="Active Clients" value={data?.activeClients ?? 0} loading={isLoading} />
      <StatCard
        label="Monthly MRR"
        value={data ? `$${data.mrr.toLocaleString()}` : "$0"}
        loading={isLoading}
      />
      <StatCard label="Total Clients" value={data?.totalClients ?? 0} loading={isLoading} />
    </div>
  );
}
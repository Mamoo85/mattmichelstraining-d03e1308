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
        openJobsRes,
        weekJobsRes,
      ] = await Promise.all([
        supabase
          .from("field_service_clients")
          .select("*", { count: "exact", head: true })
          .eq("active", true),
        supabase
          .from("field_service_clients")
          .select("*", { count: "exact", head: true }),
        supabase
          .from("field_service_clients")
          .select("plan")
          .eq("active", true),
        supabase
          .from("field_service_jobs")
          .select("*", { count: "exact", head: true })
          .not("status", "in", '("completed","invoiced")'),
        supabase
          .from("field_service_jobs")
          .select("*", { count: "exact", head: true })
          .eq("status", "completed")
          .gte("completed_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
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
        openJobs: openJobsRes.count ?? 0,
        weekJobs: weekJobsRes.count ?? 0,
      };
    },
    staleTime: 60_000,
  });

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <StatCard label="Active Clients" value={data?.activeClients ?? 0} loading={isLoading} />
      <StatCard
        label="Monthly MRR"
        value={data ? `$${data.mrr.toLocaleString()}` : "$0"}
        loading={isLoading}
      />
      <StatCard label="Open Jobs" value={data?.openJobs ?? 0} loading={isLoading} />
      <StatCard label="Jobs This Week" value={data?.weekJobs ?? 0} loading={isLoading} />
    </div>
  );
}

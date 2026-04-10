import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Job {
  id: string;
  title: string;
  priority: string | null;
  status: string | null;
  created_at: string;
  customer_company: string | null;
  client_company: string | null;
  tech_name: string | null;
}

function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function PriorityBadge({ priority }: { priority: string | null }) {
  const map: Record<string, string> = {
    emergency: "bg-red-500/20 text-red-400 border-red-500/30",
    high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    normal: "bg-[#00d4ff]/20 text-[#00d4ff] border-[#00d4ff]/30",
    low: "bg-white/10 text-white/50 border-white/20",
  };
  const key = (priority ?? "normal").toLowerCase();
  const cls = map[key] ?? map.normal;
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
      {key.charAt(0).toUpperCase() + key.slice(1)}
    </span>
  );
}

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    open: "bg-white/10 text-white/60 border-white/20",
    assigned: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    en_route: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    on_site: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    completed: "bg-green-500/20 text-green-400 border-green-500/30",
    invoiced: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  };
  const key = (status ?? "open").toLowerCase();
  const cls = map[key] ?? map.open;
  const label = key.replace("_", " ");
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
      {label.charAt(0).toUpperCase() + label.slice(1)}
    </span>
  );
}

interface Props {
  limit?: number;
}

export default function DWARecentJobs({ limit = 20 }: Props) {
  const { data: jobs = [], isLoading } = useQuery({
    queryKey: ["dwa-recent-jobs", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_service_jobs" as any)
        .select(
          `
          id,
          title,
          priority,
          status,
          created_at,
          field_service_customers ( company_name ),
          field_service_techs ( name ),
          field_service_clients ( company_name )
        `
        )
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        title: row.title,
        priority: row.priority,
        status: row.status,
        created_at: row.created_at,
        customer_company: row.field_service_customers?.company_name ?? null,
        client_company: row.field_service_clients?.company_name ?? null,
        tech_name: row.field_service_techs?.name ?? null,
      })) as Job[];
    },
    staleTime: 30_000,
  });

  return (
    <div className="flex flex-col gap-3">
      {isLoading ? (
        Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="bg-[#0f1f35] border border-white/10 rounded-xl p-4 animate-pulse"
          >
            <div className="h-4 bg-white/10 rounded w-2/3 mb-2" />
            <div className="h-3 bg-white/5 rounded w-1/2" />
          </div>
        ))
      ) : jobs.length === 0 ? (
        <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-8 text-center text-white/30">
          No jobs yet.
        </div>
      ) : (
        jobs.map((job) => (
          <div
            key={job.id}
            className="bg-[#0f1f35] border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{job.title}</p>
                <p className="text-white/50 text-xs mt-0.5">
                  {job.client_company ?? "—"}
                  {job.customer_company ? ` → ${job.customer_company}` : ""}
                </p>
                <p className="text-white/40 text-xs mt-0.5">
                  Tech: {job.tech_name ?? <span className="italic">Unassigned</span>}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <PriorityBadge priority={job.priority} />
                <StatusBadge status={job.status} />
                <span className="text-white/30 text-xs">{relativeTime(job.created_at)}</span>
              </div>
            </div>
          </div>
        ))
      )}

      {!isLoading && jobs.length > 0 && limit <= 20 && (
        <a
          href="/dwa-admin"
          className="text-center text-[#00d4ff]/70 text-sm hover:text-[#00d4ff] transition-colors py-2"
        >
          View All Jobs →
        </a>
      )}
    </div>
  );
}

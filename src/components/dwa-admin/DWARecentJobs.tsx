/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface Client {
  id: string;
  business_name: string;
  plan: string | null;
  industry: string | null;
  status: string | null;
  created_at: string;
  email: string | null;
  owner_name: string | null;
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

function StatusBadge({ status }: { status: string | null }) {
  const map: Record<string, string> = {
    active: "bg-green-500/20 text-green-400 border-green-500/30",
    inactive: "bg-white/10 text-white/60 border-white/20",
    pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  };
  const key = (status ?? "inactive").toLowerCase();
  const cls = map[key] ?? map.inactive;
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
      {key.charAt(0).toUpperCase() + key.slice(1)}
    </span>
  );
}

interface Props {
  limit?: number;
}

export default function DWARecentJobs({ limit = 20 }: Props) {
  const { data: clients = [], isLoading } = useQuery({
    queryKey: ["dwa-recent-clients", limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("field_crm_clients")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) throw error;

      return (data ?? []).map((row: any) => ({
        id: row.id,
        business_name: row.business_name,
        plan: row.plan,
        industry: row.industry,
        status: row.status,
        created_at: row.created_at,
        email: row.email,
        owner_name: row.owner_name,
      })) as Client[];
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
      ) : clients.length === 0 ? (
        <div className="bg-[#0f1f35] border border-white/10 rounded-xl p-8 text-center text-white/30">
          No clients yet.
        </div>
      ) : (
        clients.map((client) => (
          <div
            key={client.id}
            className="bg-[#0f1f35] border border-white/10 rounded-xl p-4 hover:border-white/20 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-white font-semibold text-sm truncate">{client.business_name}</p>
                <p className="text-white/50 text-xs mt-0.5">
                  {client.owner_name ?? "—"}
                  {client.email ? ` · ${client.email}` : ""}
                </p>
                <p className="text-white/40 text-xs mt-0.5">
                  {client.industry ?? "—"} · {client.plan ?? "standalone"}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5 shrink-0">
                <StatusBadge status={client.status} />
                <span className="text-white/30 text-xs">{relativeTime(client.created_at)}</span>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
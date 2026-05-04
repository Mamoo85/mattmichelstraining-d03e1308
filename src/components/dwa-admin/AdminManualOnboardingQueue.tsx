import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle2, Clock, Loader2, SkipForward, Mail, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Row = {
  id: string;
  product_slug: string;
  product_label: string;
  customer_email: string | null;
  stripe_session_id: string | null;
  stripe_subscription_id: string | null;
  amount_paid_cents: number;
  status: "pending" | "in_progress" | "completed" | "skipped";
  notes: string | null;
  created_at: string;
  completed_at: string | null;
};

const STATUS_FILTERS: { id: Row["status"] | "all"; label: string }[] = [
  { id: "pending", label: "Pending" },
  { id: "in_progress", label: "In progress" },
  { id: "completed", label: "Completed" },
  { id: "skipped", label: "Skipped" },
  { id: "all", label: "All" },
];

export default function AdminManualOnboardingQueue() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Row["status"] | "all">("pending");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["manual-onboarding-queue", filter],
    queryFn: async () => {
      let q = supabase
        .from("manual_onboarding_queue" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (filter !== "all") q = q.eq("status", filter);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as Row[];
    },
    refetchInterval: 30_000,
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: Row["status"]; notes?: string }) => {
      const patch: any = { status, updated_at: new Date().toISOString() };
      if (status === "completed") patch.completed_at = new Date().toISOString();
      if (notes !== undefined) patch.notes = notes;
      const { error } = await supabase.from("manual_onboarding_queue" as any).update(patch).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: ["manual-onboarding-queue"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const counts = { pending: 0, in_progress: 0, completed: 0, skipped: 0 } as Record<string, number>;
  rows.forEach((r) => (counts[r.status] = (counts[r.status] || 0) + 1));

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-lg font-bold text-white">Manual Onboarding Queue</h2>
        <p className="text-xs text-white/50">Wave-product signups that need manual onboarding within 24h.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {STATUS_FILTERS.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            className={`px-3 py-1.5 rounded text-xs font-semibold border transition-colors ${
              filter === f.id
                ? "bg-[#00d4ff]/20 text-[#00d4ff] border-[#00d4ff]/40"
                : "bg-white/5 text-white/60 border-transparent hover:bg-white/10"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-white/40 text-sm p-6">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : rows.length === 0 ? (
        <div className="border border-white/10 rounded-lg p-8 text-center text-white/40 text-sm">
          Queue is empty for this filter. 🎉
        </div>
      ) : (
        <div className="border border-white/10 rounded-lg divide-y divide-white/10 bg-white/[0.02]">
          {rows.map((r) => (
            <div key={r.id} className="p-4 space-y-3">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-white">{r.product_label}</span>
                    <span className="text-xs text-white/40 font-mono">{r.product_slug}</span>
                    <StatusBadge status={r.status} />
                  </div>
                  {r.customer_email && (
                    <a
                      href={`mailto:${r.customer_email}`}
                      className="text-sm text-[#00d4ff] hover:underline inline-flex items-center gap-1 mt-1"
                    >
                      <Mail className="h-3.5 w-3.5" /> {r.customer_email}
                    </a>
                  )}
                  <div className="text-xs text-white/40 mt-1">
                    ${(r.amount_paid_cents / 100).toFixed(2)} · {new Date(r.created_at).toLocaleString()}
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  {r.status !== "in_progress" && r.status !== "completed" && (
                    <button
                      onClick={() => updateStatus.mutate({ id: r.id, status: "in_progress" })}
                      className="px-3 py-1.5 text-xs bg-yellow-500/20 text-yellow-300 border border-yellow-500/40 rounded font-semibold inline-flex items-center gap-1"
                    >
                      <Clock className="h-3.5 w-3.5" /> Start
                    </button>
                  )}
                  {r.status !== "completed" && (
                    <button
                      onClick={() => updateStatus.mutate({ id: r.id, status: "completed" })}
                      className="px-3 py-1.5 text-xs bg-green-500/20 text-green-300 border border-green-500/40 rounded font-semibold inline-flex items-center gap-1"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" /> Complete
                    </button>
                  )}
                  {r.status === "pending" && (
                    <button
                      onClick={() => updateStatus.mutate({ id: r.id, status: "skipped" })}
                      className="px-3 py-1.5 text-xs bg-white/5 text-white/60 border border-white/10 rounded font-semibold inline-flex items-center gap-1"
                    >
                      <SkipForward className="h-3.5 w-3.5" /> Skip
                    </button>
                  )}
                </div>
              </div>
              {r.stripe_subscription_id && (
                <a
                  href={`https://dashboard.stripe.com/subscriptions/${r.stripe_subscription_id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-white/50 hover:text-[#00d4ff] inline-flex items-center gap-1"
                >
                  <ExternalLink className="h-3 w-3" /> {r.stripe_subscription_id}
                </a>
              )}
              <textarea
                placeholder="Notes (kickoff call scheduled, awaiting reply, etc.)"
                defaultValue={r.notes || ""}
                onBlur={(e) => {
                  if (e.target.value !== (r.notes || ""))
                    updateStatus.mutate({ id: r.id, status: r.status, notes: e.target.value });
                }}
                className="w-full bg-black/30 border border-white/10 rounded px-2 py-1.5 text-xs text-white/80 placeholder-white/30 resize-y min-h-[40px]"
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: Row["status"] }) {
  const map: Record<Row["status"], string> = {
    pending: "bg-yellow-500/20 text-yellow-300 border-yellow-500/40",
    in_progress: "bg-blue-500/20 text-blue-300 border-blue-500/40",
    completed: "bg-green-500/20 text-green-300 border-green-500/40",
    skipped: "bg-white/5 text-white/40 border-white/10",
  };
  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider border ${map[status]}`}>
      {status.replace("_", " ")}
    </span>
  );
}

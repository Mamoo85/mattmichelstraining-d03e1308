import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import AppNavbar from "@/components/layout/AppNavbar";
import ProgressCharts from "@/components/features/ProgressCharts";
import { useIsAdmin } from "@/hooks/useIsAdmin";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import ChildMonitorView, { type ChildSummary, fetchChildSummary } from "@/components/progress/ChildMonitorView";

interface ClientOption {
  user_id: string;
  label: string;
}

const Progress = () => {
  const { user } = useAuth();
  const { isAdmin, isLoading: adminLoading } = useIsAdmin();
  const [searchParams] = useSearchParams();
  const childId = searchParams.get("child");

  const [clients, setClients] = useState<ClientOption[]>([]);
  const [selectedClient, setSelectedClient] = useState("");
  const [loadingClients, setLoadingClients] = useState(false);

  const [childSummary, setChildSummary] = useState<ChildSummary | null>(null);
  const [loadingChild, setLoadingChild] = useState(false);
  const [isParentViewing, setIsParentViewing] = useState(false);

  // Admin client list
  useEffect(() => {
    if (!isAdmin) return;
    const fetchClients = async () => {
      setLoadingClients(true);
      const { data } = await supabase
        .from("profiles")
        .select("user_id, full_name, athlete_name, email")
        .order("created_at", { ascending: false });
      if (data) {
        setClients(data.map((p) => ({
          user_id: p.user_id,
          label: p.athlete_name || p.full_name || p.email || p.user_id.slice(0, 8),
        })));
      }
      setLoadingClients(false);
    };
    fetchClients();
  }, [isAdmin]);

  // Parent-child data fetch
  useEffect(() => {
    if (!childId || !user) return;
    const load = async () => {
      setLoadingChild(true);
      setIsParentViewing(true);

      const { data: link } = await supabase
        .from("parent_child_links")
        .select("id")
        .eq("parent_user_id", user.id)
        .eq("child_user_id", childId)
        .maybeSingle();

      if (!link && !isAdmin) {
        setLoadingChild(false);
        setIsParentViewing(false);
        return;
      }

      const summary = await fetchChildSummary(childId);
      setChildSummary(summary);
      setLoadingChild(false);
    };
    load();
  }, [childId, user, isAdmin]);

  const selected = clients.find((c) => c.user_id === selectedClient);
  const effectiveTargetId = childId || selectedClient || undefined;
  const effectiveTargetName = childId ? childSummary?.name : selected?.label;

  return (
    <div className="min-h-screen bg-background">
      <AppNavbar />
      <div className="container pt-20 pb-12">
        {isParentViewing && childId && (
          <ChildMonitorView childId={childId} summary={childSummary} loading={loadingChild} />
        )}

        {isAdmin && !adminLoading && !childId && (
          <div className="mb-6 p-4 bg-card border border-border">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-2">
              Admin — Select Client
            </span>
            {loadingClients ? (
              <Loader2 size={16} className="text-primary animate-spin" />
            ) : (
              <div className="flex items-center gap-3">
                <select
                  value={selectedClient}
                  onChange={(e) => setSelectedClient(e.target.value)}
                  className="bg-background border border-border text-foreground text-sm px-3 h-9 font-mono focus:ring-1 focus:ring-primary outline-none flex-1 max-w-xs"
                >
                  <option value="">My Progress</option>
                  {clients.map((c) => (
                    <option key={c.user_id} value={c.user_id}>{c.label}</option>
                  ))}
                </select>
                {selectedClient && (
                  <button onClick={() => setSelectedClient("")} className="text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-widest">
                    Clear
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        <ProgressCharts targetUserId={effectiveTargetId} targetUserName={effectiveTargetName} />
      </div>
    </div>
  );
};

export default Progress;

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import AdminTalentIngest from "@/components/dwa-admin/AdminTalentIngest";

export default function TalentIngestAdmin() {
  const { toast } = useToast();
  const [building, setBuilding] = useState(false);
  const [target, setTarget] = useState(250);

  const { data: prospects, refetch } = useQuery({
    queryKey: ["talent-prospect-list-recent"],
    queryFn: async () => {
      const { data } = await supabase
        .from("talent_prospect_list" as any)
        .select("id, company, ceo_name, ceo_email, trade_focus, state, score, status, created_at")
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  async function buildList() {
    setBuilding(true);
    const { data, error } = await supabase.functions.invoke("build-talent-prospect-list", {
      body: { target_count: target, dry_run: false },
    });
    setBuilding(false);
    if (error) {
      toast({ title: "Build failed", description: error.message, variant: "destructive" });
    } else {
      toast({
        title: "Prospect list built",
        description: `Generated ${data?.generated ?? 0}, inserted ${data?.inserted ?? 0} (run ${data?.run_id?.slice(0, 8)}…)`,
      });
      refetch();
    }
  }

  return (
    <div className="min-h-screen bg-[#0a1628] p-6 space-y-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header>
          <h1 className="text-3xl font-black text-white">🎯 Talent Ingest</h1>
          <p className="text-white/60 text-sm mt-1">
            Scanner runs viewer, replay, and 250-row prospect list builder for cold-email outreach.
          </p>
        </header>

        <section className="bg-white/5 border border-white/10 rounded-lg p-5">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-white font-bold text-lg">Build prospect list</h2>
            <input
              type="number"
              value={target}
              onChange={(e) => setTarget(parseInt(e.target.value || "250", 10))}
              min={10}
              max={500}
              className="w-24 bg-white/10 border border-white/20 rounded px-2 py-1 text-white text-sm"
            />
            <Button
              onClick={buildList}
              disabled={building}
              className="bg-[#00d4ff] text-[#0a1628] hover:bg-[#00d4ff]/90 font-bold"
            >
              {building ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              Build {target} prospects
            </Button>
            <span className="text-white/40 text-xs ml-auto">
              Apollo → Talent Radar signals → personalized cold emails
            </span>
          </div>
        </section>

        <section className="bg-white/5 border border-white/10 rounded-lg p-5">
          <h2 className="text-white font-bold text-lg mb-3">Recent runs (with replay)</h2>
          <AdminTalentIngest />
        </section>

        <section className="bg-white/5 border border-white/10 rounded-lg overflow-hidden">
          <div className="p-4 border-b border-white/10">
            <h2 className="text-white font-bold text-lg">Latest 50 prospects</h2>
          </div>
          <table className="w-full text-sm text-white">
            <thead className="bg-white/5 text-white/60">
              <tr>
                <th className="text-left p-2">Company</th>
                <th className="text-left p-2">CEO</th>
                <th className="text-left p-2">Email</th>
                <th className="text-left p-2">Trade</th>
                <th className="text-left p-2">State</th>
                <th className="text-right p-2">Score</th>
                <th className="text-left p-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {(prospects || []).map((p: any) => (
                <tr key={p.id} className="border-t border-white/5">
                  <td className="p-2">{p.company}</td>
                  <td className="p-2 text-white/70">{p.ceo_name || "—"}</td>
                  <td className="p-2 text-white/70">{p.ceo_email || "—"}</td>
                  <td className="p-2 text-cyan-300">{p.trade_focus || "—"}</td>
                  <td className="p-2">{p.state || "—"}</td>
                  <td className="p-2 text-right">{p.score ?? 0}</td>
                  <td className="p-2 text-emerald-300">{p.status}</td>
                </tr>
              ))}
              {(!prospects || prospects.length === 0) && (
                <tr>
                  <td colSpan={7} className="p-6 text-center text-white/40">
                    No prospects yet. Click "Build {target} prospects" above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Row = { county: string; leads: number; contractors: number };

const AdminCoverageMap = () => {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const sinceISO = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const [leadsRes, contractorsRes] = await Promise.all([
        supabase
          .from("contractor_leads")
          .select("created_at, contractor_lead_sites(city, state)")
          .gte("created_at", sinceISO)
          .limit(2000),
        supabase.from("contractor_clients").select("city, state").eq("active", true).limit(1000),
      ]);
      const leads = (leadsRes.data || []) as any[];
      const contractors = (contractorsRes.data || []) as any[];

      const counts = new Map<string, Row>();
      for (const l of leads) {
        const city = l.contractor_lead_sites?.city || "Unknown";
        const key = city.toLowerCase();
        const cur = counts.get(key) || { county: city, leads: 0, contractors: 0 };
        cur.leads++;
        counts.set(key, cur);
      }
      for (const c of contractors || []) {
        const key = (c.city || "Unknown").toLowerCase();
        const cur = counts.get(key) || { county: c.city || "Unknown", leads: 0, contractors: 0 };
        cur.contractors++;
        counts.set(key, cur);
      }
      setRows(Array.from(counts.values()).sort((a, b) => b.leads - a.leads));
      setLoading(false);
    })();
  }, []);

  const heat = (leads: number, contractors: number) => {
    if (leads === 0) return "muted";
    const ratio = contractors === 0 ? 99 : leads / contractors;
    if (ratio >= 5) return "destructive";
    if (ratio >= 2) return "default";
    return "secondary";
  };

  const totals = useMemo(
    () => rows.reduce((acc, r) => ({ leads: acc.leads + r.leads, contractors: acc.contractors + r.contractors }), { leads: 0, contractors: 0 }),
    [rows]
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h2 className="text-xl font-semibold">Coverage Heatmap</h2>
          <p className="text-xs text-muted-foreground">Last 30 days · {totals.leads} leads vs {totals.contractors} active contractors</p>
        </div>
        <div className="flex gap-2 text-xs">
          <Badge variant="destructive">High demand / low coverage</Badge>
          <Badge variant="default">Moderate</Badge>
          <Badge variant="secondary">Well covered</Badge>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground text-sm">Loading…</p>
      ) : (
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-left">
                <th className="p-3">City / County</th>
                <th className="p-3 text-right">Leads (30d)</th>
                <th className="p-3 text-right">Active Contractors</th>
                <th className="p-3 text-right">Demand Ratio</th>
                <th className="p-3 text-right">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const ratio = r.contractors === 0 ? "—" : (r.leads / r.contractors).toFixed(1);
                return (
                  <tr key={r.county} className="border-t border-border">
                    <td className="p-3 font-medium">{r.county}</td>
                    <td className="p-3 text-right">{r.leads}</td>
                    <td className="p-3 text-right">{r.contractors}</td>
                    <td className="p-3 text-right">{ratio}</td>
                    <td className="p-3 text-right">
                      <Badge variant={heat(r.leads, r.contractors) as any}>
                        {r.contractors === 0 ? "Recruit" : r.leads / Math.max(1, r.contractors) >= 2 ? "Hot" : "Covered"}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}
    </div>
  );
};

export default AdminCoverageMap;

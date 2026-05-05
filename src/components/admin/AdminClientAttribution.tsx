import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Source = "cold_email" | "sms" | "referral" | "organic" | "linkedin" | "paid_ad" | "direct" | "unknown";

const SOURCES: Source[] = ["cold_email", "sms", "referral", "organic", "linkedin", "paid_ad", "direct"];

const SOURCE_LABELS: Record<Source | "unknown", string> = {
  cold_email: "Cold Email", sms: "SMS", referral: "Referral",
  organic: "Organic", linkedin: "LinkedIn", paid_ad: "Paid Ad",
  direct: "Direct", unknown: "Unknown",
};

const SOURCE_COLORS: Record<string, string> = {
  cold_email: "bg-cyan-900 text-cyan-300",
  sms: "bg-purple-900 text-purple-300",
  referral: "bg-green-900 text-green-300",
  organic: "bg-yellow-900 text-yellow-300",
  linkedin: "bg-blue-900 text-blue-300",
  paid_ad: "bg-orange-900 text-orange-300",
  direct: "bg-slate-700 text-slate-300",
  unknown: "bg-slate-800 text-slate-500",
};

interface Client {
  id: string;
  email: string;
  contact_name?: string | null;
  owner_name?: string | null;
  business_name?: string | null;
  acquisition_source?: string | null;
  closed_at?: string | null;
  created_at: string;
  _product: string;
  _table: string;
}

const TABLES = [
  { table: "hire_alert_clients",   product: "TechAlert",      emailCol: "owner_email", nameCol: "owner_name" },
  { table: "trade_radar_clients",  product: "Trade Radar",     emailCol: "email",       nameCol: "contact_name" },
  { table: "mortgage_radar_clients", product: "Mortgage Radar", emailCol: "email",       nameCol: "contact_name" },
];

export default function AdminClientAttribution() {
  const qc = useQueryClient();
  const [filterSource, setFilterSource] = useState<string>("all");

  const { data: clients, isLoading } = useQuery({
    queryKey: ["client_attribution"],
    queryFn: async () => {
      const results: Client[] = [];
      for (const t of TABLES) {
        const { data } = await (supabase as any)
          .from(t.table)
          .select(`id, ${t.emailCol}, ${t.nameCol}, business_name, acquisition_source, closed_at, created_at`)
          .eq("active", true)
          .order("created_at", { ascending: false })
          .limit(100);
        for (const row of (data || []) as any[]) {
          results.push({
            id: row.id,
            email: row[t.emailCol] || "",
            contact_name: row[t.nameCol] || null,
            business_name: row.business_name || null,
            acquisition_source: row.acquisition_source || null,
            closed_at: row.closed_at || null,
            created_at: row.created_at,
            _product: t.product,
            _table: t.table,
          });
        }
      }
      return results.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    },
  });

  const setSource = useMutation({
    mutationFn: async ({ id, table, source }: { id: string; table: string; source: string }) => {
      await (supabase as any).from(table).update({ acquisition_source: source }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["client_attribution"] }),
  });

  const filtered = (clients || []).filter((c) =>
    filterSource === "all" || (c.acquisition_source || "unknown") === filterSource
  );

  // Source breakdown counts
  const sourceCounts: Record<string, number> = {};
  for (const c of clients || []) {
    const s = c.acquisition_source || "unknown";
    sourceCounts[s] = (sourceCounts[s] || 0) + 1;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white mb-1">Client Attribution</h2>
        <p className="text-sm text-slate-400">Tag how each client was acquired to track what's working</p>
      </div>

      {/* Source breakdown */}
      <div className="flex flex-wrap gap-2">
        {[["all", "All Clients", clients?.length || 0], ...Object.entries(sourceCounts)].map(([src, label, cnt]) => {
          const s = src as string;
          const count = s === "all" ? (clients?.length || 0) : (sourceCounts[s] || 0);
          return (
            <button
              key={s}
              onClick={() => setFilterSource(s)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filterSource === s ? "bg-cyan-600 text-white" : "bg-slate-800 text-slate-400 hover:bg-slate-700"
              }`}
            >
              {s === "all" ? "All" : SOURCE_LABELS[s as Source] || s} ({count})
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        {isLoading && <p className="text-slate-400 text-sm">Loading clients…</p>}
        {!isLoading && !filtered.length && (
          <p className="text-slate-500 text-sm">No clients match this filter.</p>
        )}
        {filtered.map((c) => (
          <Card key={`${c._table}-${c.id}`} className="bg-[#162236] border-slate-700">
            <CardContent className="p-3 flex items-center gap-3 flex-wrap">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white text-sm font-medium truncate">{c.business_name || c.email}</span>
                  <Badge className="text-xs bg-slate-700 text-slate-300">{c._product}</Badge>
                  {c.acquisition_source ? (
                    <Badge className={`text-xs ${SOURCE_COLORS[c.acquisition_source] || SOURCE_COLORS.unknown}`}>
                      {SOURCE_LABELS[c.acquisition_source as Source] || c.acquisition_source}
                    </Badge>
                  ) : (
                    <Badge className="text-xs bg-red-950 text-red-400">Untagged</Badge>
                  )}
                </div>
                <p className="text-slate-400 text-xs mt-0.5">{c.email} · {new Date(c.created_at).toLocaleDateString()}</p>
              </div>
              <Select
                value={c.acquisition_source || ""}
                onValueChange={(val) => setSource.mutate({ id: c.id, table: c._table, source: val })}
              >
                <SelectTrigger className="w-36 h-7 text-xs bg-slate-800 border-slate-600 text-slate-300">
                  <SelectValue placeholder="Tag source…" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 border-slate-700">
                  {SOURCES.map((s) => (
                    <SelectItem key={s} value={s} className="text-xs text-slate-300">{SOURCE_LABELS[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

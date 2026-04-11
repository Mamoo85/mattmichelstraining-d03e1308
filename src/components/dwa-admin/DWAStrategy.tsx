import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { Save, Printer, Plus, Trash2 } from "lucide-react";

const PIE_COLORS = ["#00d4ff", "#00ff94", "#ff6b6b", "#ffd93d", "#6c5ce7", "#fd79a8", "#00cec9", "#e17055", "#74b9ff", "#a29bfe"];

interface Strategy {
  id: string;
  primary_targets: string[];
  secondary_targets: string[];
  monthly_overhead_target: number;
  monthly_revenue_target: number;
  mission_statement: string;
  competitive_advantages: string[];
  key_risks: string[];
  quarterly_goals: any[];
}

interface AdSpend {
  id: string;
  platform: string;
  percentage_allocation: number;
  monthly_budget: number;
  status: string;
  notes: string;
}

export default function DWAStrategy() {
  const { toast } = useToast();
  const qc = useQueryClient();

  // --- Strategy ---
  const { data: strategy } = useQuery({
    queryKey: ["business-strategy"],
    queryFn: async () => {
      const { data, error } = await supabase.from("business_strategy").select("*").limit(1).single();
      if (error && error.code === "PGRST116") {
        // No row yet — create default
        const { data: created, error: insertErr } = await supabase.from("business_strategy").insert({}).select().single();
        if (insertErr) throw insertErr;
        return created as unknown as Strategy;
      }
      if (error) throw error;
      return data as unknown as Strategy;
    },
  });

  const [stForm, setStForm] = useState<Partial<Strategy> | null>(null);
  const editingStrategy = stForm !== null;
  const st = stForm ?? strategy;

  const saveStrategy = useMutation({
    mutationFn: async (d: Partial<Strategy>) => {
      const { id, ...rest } = d as any;
      const { error } = await supabase.from("business_strategy").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["business-strategy"] }); setStForm(null); toast({ title: "Strategy saved" }); },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // --- Ad Spend ---
  const { data: adSpend = [] } = useQuery({
    queryKey: ["ad-spend"],
    queryFn: async () => {
      const { data, error } = await supabase.from("ad_spend_allocation").select("*").order("percentage_allocation", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as AdSpend[];
    },
  });

  const [newPlatform, setNewPlatform] = useState({ platform: "", percentage_allocation: 0, monthly_budget: 0, status: "planned", notes: "" });

  const addPlatform = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("ad_spend_allocation").insert(newPlatform);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ad-spend"] });
      setNewPlatform({ platform: "", percentage_allocation: 0, monthly_budget: 0, status: "planned", notes: "" });
      toast({ title: "Platform added" });
    },
  });

  const updateSpend = useMutation({
    mutationFn: async ({ id, ...rest }: Partial<AdSpend> & { id: string }) => {
      const { error } = await supabase.from("ad_spend_allocation").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ad-spend"] }),
  });

  const deleteSpend = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ad_spend_allocation").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ad-spend"] }),
  });

  const pieData = adSpend.filter((a) => a.percentage_allocation > 0).map((a) => ({ name: a.platform, value: a.percentage_allocation }));
  const totalBudget = adSpend.reduce((s, a) => s + a.monthly_budget, 0);

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Print Header */}
      <div className="hidden print:block mb-4">
        <h1 className="text-2xl font-bold text-black">DETROIT WEB AGENCY — Strategy Overview</h1>
        <p className="text-sm text-gray-500">Generated {new Date().toLocaleDateString()}</p>
      </div>

      <div className="flex items-center justify-between print:hidden">
        <h2 className="text-white/40 text-xs uppercase tracking-wide">Business Strategy</h2>
        <div className="flex gap-2">
          {!editingStrategy && strategy && (
            <Button size="sm" variant="outline" onClick={() => setStForm({ ...strategy })} className="text-xs border-white/10 text-white/60">Edit</Button>
          )}
          {editingStrategy && (
            <>
              <Button size="sm" onClick={() => saveStrategy.mutate(stForm!)} className="bg-[#00d4ff] text-black text-xs"><Save className="h-3 w-3 mr-1" /> Save</Button>
              <Button size="sm" variant="outline" onClick={() => setStForm(null)} className="text-xs border-white/10 text-white/60">Cancel</Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => window.print()} className="text-xs border-white/10 text-white/60">
            <Printer className="h-3 w-3 mr-1" /> Print
          </Button>
        </div>
      </div>

      {st && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Mission */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 lg:col-span-2 print:bg-white print:border-gray-300">
            <Label className="text-white/40 text-xs print:text-gray-500">Mission Statement</Label>
            {editingStrategy ? (
              <Textarea value={stForm!.mission_statement ?? ""} onChange={(e) => setStForm({ ...stForm!, mission_statement: e.target.value })} rows={3} className="bg-white/5 border-white/10 text-white text-sm mt-1" />
            ) : (
              <p className="text-white/80 text-sm mt-1 print:text-black">{st.mission_statement || "Not set"}</p>
            )}
          </div>

          {/* Targets */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 print:bg-white print:border-gray-300">
            <Label className="text-white/40 text-xs print:text-gray-500">Revenue Target</Label>
            {editingStrategy ? (
              <Input type="number" value={stForm!.monthly_revenue_target ?? 0} onChange={(e) => setStForm({ ...stForm!, monthly_revenue_target: +e.target.value })} className="bg-white/5 border-white/10 text-white text-sm mt-1" />
            ) : (
              <p className="text-[#00d4ff] text-2xl font-bold mt-1 print:text-black">${st.monthly_revenue_target?.toLocaleString() ?? "0"}/mo</p>
            )}
          </div>
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 print:bg-white print:border-gray-300">
            <Label className="text-white/40 text-xs print:text-gray-500">Overhead Target</Label>
            {editingStrategy ? (
              <Input type="number" value={stForm!.monthly_overhead_target ?? 0} onChange={(e) => setStForm({ ...stForm!, monthly_overhead_target: +e.target.value })} className="bg-white/5 border-white/10 text-white text-sm mt-1" />
            ) : (
              <p className="text-white text-2xl font-bold mt-1 print:text-black">${st.monthly_overhead_target?.toLocaleString() ?? "0"}/mo</p>
            )}
          </div>

          {/* Primary Targets */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 print:bg-white print:border-gray-300">
            <Label className="text-white/40 text-xs print:text-gray-500">Primary Targets</Label>
            {editingStrategy ? (
              <Input
                value={(stForm!.primary_targets ?? []).join(", ")}
                onChange={(e) => setStForm({ ...stForm!, primary_targets: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                className="bg-white/5 border-white/10 text-white text-sm mt-1"
                placeholder="HVAC, Plumbing, Electrical…"
              />
            ) : (
              <div className="flex flex-wrap gap-1 mt-1">
                {(st.primary_targets ?? []).map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded text-xs bg-[#00d4ff]/20 text-[#00d4ff] print:bg-blue-100 print:text-blue-800">{t}</span>
                ))}
                {(!st.primary_targets || st.primary_targets.length === 0) && <span className="text-white/30 text-xs">None set</span>}
              </div>
            )}
          </div>

          {/* Secondary Targets */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 print:bg-white print:border-gray-300">
            <Label className="text-white/40 text-xs print:text-gray-500">Secondary Targets</Label>
            {editingStrategy ? (
              <Input
                value={(stForm!.secondary_targets ?? []).join(", ")}
                onChange={(e) => setStForm({ ...stForm!, secondary_targets: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                className="bg-white/5 border-white/10 text-white text-sm mt-1"
              />
            ) : (
              <div className="flex flex-wrap gap-1 mt-1">
                {(st.secondary_targets ?? []).map((t) => (
                  <span key={t} className="px-2 py-0.5 rounded text-xs bg-white/10 text-white/70 print:bg-gray-200 print:text-black">{t}</span>
                ))}
                {(!st.secondary_targets || st.secondary_targets.length === 0) && <span className="text-white/30 text-xs">None set</span>}
              </div>
            )}
          </div>

          {/* Competitive Advantages */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 print:bg-white print:border-gray-300">
            <Label className="text-white/40 text-xs print:text-gray-500">Competitive Advantages</Label>
            {editingStrategy ? (
              <Textarea
                value={(stForm!.competitive_advantages ?? []).join("\n")}
                onChange={(e) => setStForm({ ...stForm!, competitive_advantages: e.target.value.split("\n").filter(Boolean) })}
                rows={4}
                className="bg-white/5 border-white/10 text-white text-xs mt-1"
                placeholder="One per line"
              />
            ) : (
              <ul className="mt-1 space-y-1">
                {(st.competitive_advantages ?? []).map((a, i) => (
                  <li key={i} className="text-white/70 text-xs print:text-black">• {a}</li>
                ))}
              </ul>
            )}
          </div>

          {/* Key Risks */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 print:bg-white print:border-gray-300">
            <Label className="text-white/40 text-xs print:text-gray-500">Key Risks</Label>
            {editingStrategy ? (
              <Textarea
                value={(stForm!.key_risks ?? []).join("\n")}
                onChange={(e) => setStForm({ ...stForm!, key_risks: e.target.value.split("\n").filter(Boolean) })}
                rows={4}
                className="bg-white/5 border-white/10 text-white text-xs mt-1"
                placeholder="One per line"
              />
            ) : (
              <ul className="mt-1 space-y-1">
                {(st.key_risks ?? []).map((r, i) => (
                  <li key={i} className="text-red-400/80 text-xs print:text-red-700">⚠ {r}</li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Ad Spend Section */}
      <div>
        <h2 className="text-white/40 text-xs uppercase tracking-wide mb-3 print:text-gray-500">Ad Spend Allocation — ${totalBudget.toLocaleString()}/mo total</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Pie Chart */}
          <div className="bg-white/5 border border-white/10 rounded-lg p-4 print:bg-white print:border-gray-300">
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, value }) => `${name} (${value}%)`} labelLine={false}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-64 text-white/30 text-sm">Add platforms to see allocation chart</div>
            )}
          </div>

          {/* Platform Table */}
          <div className="space-y-2">
            {adSpend.map((a) => (
              <div key={a.id} className="bg-white/5 border border-white/10 rounded-lg p-3 print:bg-white print:border-gray-300">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-medium text-sm print:text-black">{a.platform}</span>
                  <div className="flex items-center gap-2 print:hidden">
                    <span className={`px-1.5 py-0.5 rounded text-xs ${a.status === "active" ? "bg-green-500/20 text-green-400" : a.status === "paused" ? "bg-yellow-500/20 text-yellow-400" : "bg-white/10 text-white/40"}`}>
                      {a.status}
                    </span>
                    <Button size="sm" variant="ghost" onClick={() => deleteSpend.mutate(a.id)} className="h-6 w-6 p-0 text-white/30 hover:text-red-400">
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
                {/* Progress bar */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-2 bg-white/10 rounded-full overflow-hidden print:bg-gray-200">
                    <div className="h-full bg-[#00d4ff] rounded-full print:bg-blue-500" style={{ width: `${Math.min(a.percentage_allocation, 100)}%` }} />
                  </div>
                  <span className="text-white/60 text-xs w-12 text-right print:text-black">{a.percentage_allocation}%</span>
                  <span className="text-white/40 text-xs w-20 text-right print:text-gray-600">${a.monthly_budget}</span>
                </div>
                {a.notes && <p className="text-white/30 text-xs mt-1 print:text-gray-500">{a.notes}</p>}
              </div>
            ))}

            {/* Add Platform */}
            <div className="bg-white/5 border border-dashed border-white/20 rounded-lg p-3 space-y-2 print:hidden">
              <div className="grid grid-cols-2 gap-2">
                <Input value={newPlatform.platform} onChange={(e) => setNewPlatform({ ...newPlatform, platform: e.target.value })} placeholder="Platform name" className="bg-white/5 border-white/10 text-white text-xs" />
                <select value={newPlatform.status} onChange={(e) => setNewPlatform({ ...newPlatform, status: e.target.value })} className="h-10 rounded-md bg-white/5 border border-white/10 text-white text-xs px-3">
                  <option value="planned" className="bg-[#0a1628]">Planned</option>
                  <option value="active" className="bg-[#0a1628]">Active</option>
                  <option value="paused" className="bg-[#0a1628]">Paused</option>
                </select>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" value={newPlatform.percentage_allocation} onChange={(e) => setNewPlatform({ ...newPlatform, percentage_allocation: +e.target.value })} placeholder="%" className="bg-white/5 border-white/10 text-white text-xs" />
                <Input type="number" value={newPlatform.monthly_budget} onChange={(e) => setNewPlatform({ ...newPlatform, monthly_budget: +e.target.value })} placeholder="$/mo" className="bg-white/5 border-white/10 text-white text-xs" />
              </div>
              <Button size="sm" onClick={() => addPlatform.mutate()} disabled={!newPlatform.platform || addPlatform.isPending} className="w-full bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/30 text-xs">
                <Plus className="h-3 w-3 mr-1" /> Add Platform
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

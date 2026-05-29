import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Search, Printer, Eye, EyeOff, Plus, Save, Trash2, ChevronDown, ChevronRight } from "lucide-react";

type WikiCategory = "core_product" | "add_on" | "system" | "process";

interface WikiEntry {
  id: string;
  product_name: string;
  category: WikiCategory;
  description: string;
  client_description: string;
  priority_rank: number;
  tech_stack: string[];
  monthly_operating_cost: number;
  dev_hours_spent: number;
  active_hooks_count: number;
  agent_connections: string[];
  printable_steps: { title: string; body: string; image_url?: string }[];
  updated_by: string;
  last_updated: string;
}

const CATEGORY_LABELS: Record<WikiCategory, string> = {
  core_product: "Core Products",
  add_on: "Add-Ons",
  system: "Systems",
  process: "Processes",
};

const CATEGORY_ORDER: WikiCategory[] = ["core_product", "add_on", "system", "process"];

export default function DWAPlaybook() {
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isClientView, setIsClientView] = useState(false);
  const [editing, setEditing] = useState(false);
  const [expandedCats, setExpandedCats] = useState<Set<WikiCategory>>(new Set(CATEGORY_ORDER));
  const { toast } = useToast();
  const qc = useQueryClient();

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["product-wiki"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("product_wiki")
        .select("*")
        .order("priority_rank", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as WikiEntry[];
    },
  });

  const selected = useMemo(() => entries.find((e) => e.id === selectedId) ?? null, [entries, selectedId]);

  const filtered = useMemo(() => {
    if (!search.trim()) return entries;
    const q = search.toLowerCase();
    return entries.filter(
      (e) =>
        e.product_name.toLowerCase().includes(q) ||
        e.description.toLowerCase().includes(q) ||
        e.tech_stack.some((t) => t.toLowerCase().includes(q))
    );
  }, [entries, search]);

  const grouped = useMemo(() => {
    const map: Record<WikiCategory, WikiEntry[]> = { core_product: [], add_on: [], system: [], process: [] };
    filtered.forEach((e) => map[e.category]?.push(e));
    return map;
  }, [filtered]);

  // --- Form state for editing ---
  const [form, setForm] = useState<Partial<WikiEntry>>({});

  const startEdit = (entry: WikiEntry) => {
    setForm({ ...entry });
    setEditing(true);
  };

  const saveMutation = useMutation({
    mutationFn: async (data: Partial<WikiEntry>) => {
      const { id, last_updated, ...rest } = data as any;
      if (id) {
        const { error } = await supabase.from("product_wiki").update(rest).eq("id", id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("product_wiki").insert(rest);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-wiki"] });
      setEditing(false);
      toast({ title: "Saved" });
    },
    onError: (e) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("product_wiki").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["product-wiki"] });
      setSelectedId(null);
      setEditing(false);
      toast({ title: "Deleted" });
    },
  });

  const toggleCat = (c: WikiCategory) => {
    setExpandedCats((prev) => {
      const n = new Set(prev);
      n.has(c) ? n.delete(c) : n.add(c);
      return n;
    });
  };

  const handlePrint = (clientOnly: boolean) => {
    setIsClientView(clientOnly);
    setTimeout(() => window.print(), 200);
  };

  const newEntry = () => {
    setForm({
      product_name: "",
      category: "core_product",
      description: "",
      client_description: "",
      priority_rank: entries.length + 1,
      tech_stack: [],
      monthly_operating_cost: 0,
      dev_hours_spent: 0,
      active_hooks_count: 0,
      agent_connections: [],
      printable_steps: [],
      updated_by: "Matt",
    });
    setSelectedId(null);
    setEditing(true);
  };

  // --- Render ---
  if (isLoading) return <div className="text-white/40 text-sm">Loading playbook…</div>;

  return (
    <div className="flex gap-4 min-h-[70vh] print:block">
      {/* Sidebar */}
      <aside className="w-64 shrink-0 space-y-2 print:hidden">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-white/30" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search playbook…"
            className="pl-9 bg-white/5 border-white/10 text-white text-sm h-9"
          />
        </div>
        <Button size="sm" onClick={newEntry} className="w-full bg-[#00d4ff]/20 text-[#00d4ff] border border-[#00d4ff]/30 hover:bg-[#00d4ff]/30 text-xs">
          <Plus className="h-3 w-3 mr-1" /> New Entry
        </Button>

        {CATEGORY_ORDER.map((cat) => (
          <div key={cat}>
            <button onClick={() => toggleCat(cat)} className="flex items-center gap-1 text-white/50 text-xs uppercase tracking-wide w-full py-1.5 hover:text-white/70">
              {expandedCats.has(cat) ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
              {CATEGORY_LABELS[cat]} ({grouped[cat].length})
            </button>
            {expandedCats.has(cat) &&
              grouped[cat].map((e) => (
                <button
                  key={e.id}
                  onClick={() => { setSelectedId(e.id); setEditing(false); }}
                  className={`block w-full text-left px-3 py-1.5 rounded text-xs truncate transition-colors ${
                    selectedId === e.id ? "bg-[#00d4ff]/20 text-[#00d4ff]" : "text-white/60 hover:text-white/80 hover:bg-white/5"
                  }`}
                >
                  {e.product_name}
                </button>
              ))}
          </div>
        ))}
      </aside>

      {/* Main Panel */}
      <div className="flex-1 min-w-0">
        {!selected && !editing && (
          <div className="flex items-center justify-center h-64 text-white/30 text-sm">
            Select an entry or create a new one
          </div>
        )}

        {/* View Mode */}
        {selected && !editing && (
          <div className="space-y-4">
            {/* Actions */}
            <div className="flex items-center gap-2 print:hidden">
              <Button size="sm" variant="outline" onClick={() => setIsClientView(!isClientView)} className="text-xs border-white/10 text-white/60">
                {isClientView ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                {isClientView ? "Client View" : "Matt's View"}
              </Button>
              <Button size="sm" variant="outline" onClick={() => startEdit(selected)} className="text-xs border-white/10 text-white/60">Edit</Button>
              <Button size="sm" variant="outline" onClick={() => handlePrint(false)} className="text-xs border-white/10 text-white/60">
                <Printer className="h-3 w-3 mr-1" /> Print Matt's
              </Button>
              <Button size="sm" variant="outline" onClick={() => handlePrint(true)} className="text-xs border-white/10 text-white/60">
                <Printer className="h-3 w-3 mr-1" /> Print Client
              </Button>
            </div>

            {/* Print Header */}
            <div className="hidden print:block mb-4">
              <h1 className="text-2xl font-bold text-black">DETROIT WEB AGENCY</h1>
              <p className="text-sm text-gray-500">{isClientView ? "Client Documentation" : "Internal Playbook"}</p>
            </div>

            <h2 className="text-xl font-bold text-white print:text-black">{selected.product_name}</h2>
            <span className="inline-block px-2 py-0.5 rounded text-xs bg-[#00d4ff]/20 text-[#00d4ff] print:bg-gray-200 print:text-black">
              {CATEGORY_LABELS[selected.category]}
            </span>

            {/* Description */}
            <div className="bg-white/5 border border-white/10 rounded-lg p-4 print:bg-white print:border-gray-300">
              <h3 className="text-white/40 text-xs uppercase tracking-wide mb-2 print:text-gray-500">
                {isClientView ? "Service Description" : "Internal Description"}
              </h3>
              <div className="text-white/80 text-sm whitespace-pre-wrap print:text-black">
                {isClientView ? selected.client_description || "No client description yet." : selected.description || "No description yet."}
              </div>
            </div>

            {/* Metrics — Matt only */}
            {!isClientView && (
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 print:grid-cols-5">
                {[
                  { label: "Priority", value: `#${selected.priority_rank}` },
                  { label: "Monthly Cost", value: `$${selected.monthly_operating_cost}` },
                  { label: "Dev Hours", value: `${selected.dev_hours_spent}h` },
                  { label: "Active Hooks", value: selected.active_hooks_count },
                  { label: "Agents", value: selected.agent_connections.length },
                ].map((m) => (
                  <div key={m.label} className="bg-white/5 border border-white/10 rounded-lg p-3 text-center print:bg-gray-50 print:border-gray-300">
                    <div className="text-white/40 text-xs print:text-gray-500">{m.label}</div>
                    <div className="text-white text-lg font-bold print:text-black">{m.value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* Tech Stack */}
            {!isClientView && selected.tech_stack.length > 0 && (
              <div>
                <h3 className="text-white/40 text-xs uppercase tracking-wide mb-2 print:text-gray-500">Tech Stack</h3>
                <div className="flex flex-wrap gap-1.5">
                  {selected.tech_stack.map((t) => (
                    <span key={t} className="px-2 py-0.5 rounded text-xs bg-white/10 text-white/70 print:bg-gray-200 print:text-black">{t}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Agent Connections — Matt only */}
            {!isClientView && selected.agent_connections.length > 0 && (
              <div>
                <h3 className="text-white/40 text-xs uppercase tracking-wide mb-2 print:text-gray-500">Agent Connections</h3>
                <div className="flex flex-wrap gap-1.5">
                  {selected.agent_connections.map((a) => (
                    <span key={a} className="px-2 py-0.5 rounded text-xs bg-[#00d4ff]/10 text-[#00d4ff]/80 border border-[#00d4ff]/20 print:bg-blue-50 print:text-blue-800 print:border-blue-200">{a}</span>
                  ))}
                </div>
              </div>
            )}

            {/* Step-by-Step Guide */}
            {selected.printable_steps && (selected.printable_steps as any[]).length > 0 && (
              <div>
                <h3 className="text-white/40 text-xs uppercase tracking-wide mb-2 print:text-gray-500">Step-by-Step Guide</h3>
                <ol className="space-y-3">
                  {(selected.printable_steps as any[]).map((step: any, i: number) => (
                    <li key={i} className="bg-white/5 border border-white/10 rounded-lg p-3 print:bg-gray-50 print:border-gray-300">
                      <div className="flex items-start gap-2">
                        <span className="bg-[#00d4ff]/20 text-[#00d4ff] rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shrink-0 print:bg-blue-100 print:text-blue-800">
                          {i + 1}
                        </span>
                        <div className="min-w-0">
                          <div className="text-white font-medium text-sm print:text-black">{step.title}</div>
                          <div className="text-white/60 text-xs mt-1 whitespace-pre-wrap print:text-gray-600">{step.body}</div>
                          {step.image_url && (
                            <img src={step.image_url} alt={step.title} className="mt-2 rounded max-h-48 object-contain" />
                          )}
                        </div>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            <p className="text-white/20 text-xs print:text-gray-400">
              Last updated: {new Date(selected.last_updated).toLocaleDateString()} by {selected.updated_by || "—"}
            </p>
          </div>
        )}

        {/* Edit Mode */}
        {editing && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-white text-lg font-bold">{form.id ? "Edit Entry" : "New Entry"}</h2>
              <div className="flex gap-2">
                <Button size="sm" onClick={() => saveMutation.mutate(form)} disabled={saveMutation.isPending} className="bg-[#00d4ff] text-black hover:bg-[#00d4ff]/80 text-xs">
                  <Save className="h-3 w-3 mr-1" /> Save
                </Button>
                {form.id && (
                  <Button size="sm" variant="destructive" onClick={() => deleteMutation.mutate(form.id!)} className="text-xs">
                    <Trash2 className="h-3 w-3 mr-1" /> Delete
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setEditing(false)} className="text-xs border-white/10 text-white/60">Cancel</Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label className="text-white/50 text-xs">Product Name</Label>
                <Input value={form.product_name ?? ""} onChange={(e) => setForm({ ...form, product_name: e.target.value })} className="bg-white/5 border-white/10 text-white text-sm" />
              </div>
              <div>
                <Label className="text-white/50 text-xs">Category</Label>
                <select
                  value={form.category ?? "core_product"}
                  onChange={(e) => setForm({ ...form, category: e.target.value as WikiCategory })}
                  className="w-full h-10 rounded-md bg-white/5 border border-white/10 text-white text-sm px-3"
                >
                  {CATEGORY_ORDER.map((c) => <option key={c} value={c} className="bg-[#0a1628]">{CATEGORY_LABELS[c]}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-white/50 text-xs">Priority Rank</Label>
                <Input type="number" value={form.priority_rank ?? 0} onChange={(e) => setForm({ ...form, priority_rank: +e.target.value })} className="bg-white/5 border-white/10 text-white text-sm" />
              </div>
              <div>
                <Label className="text-white/50 text-xs">Monthly Cost ($)</Label>
                <Input type="number" value={form.monthly_operating_cost ?? 0} onChange={(e) => setForm({ ...form, monthly_operating_cost: +e.target.value })} className="bg-white/5 border-white/10 text-white text-sm" />
              </div>
              <div>
                <Label className="text-white/50 text-xs">Dev Hours</Label>
                <Input type="number" value={form.dev_hours_spent ?? 0} onChange={(e) => setForm({ ...form, dev_hours_spent: +e.target.value })} className="bg-white/5 border-white/10 text-white text-sm" />
              </div>
              <div>
                <Label className="text-white/50 text-xs">Active Hooks</Label>
                <Input type="number" value={form.active_hooks_count ?? 0} onChange={(e) => setForm({ ...form, active_hooks_count: +e.target.value })} className="bg-white/5 border-white/10 text-white text-sm" />
              </div>
            </div>

            <div>
              <Label className="text-white/50 text-xs">Tech Stack (comma-separated)</Label>
              <Input
                value={(form.tech_stack ?? []).join(", ")}
                onChange={(e) => setForm({ ...form, tech_stack: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                className="bg-white/5 border-white/10 text-white text-sm"
                placeholder="React, Supabase, Stripe…"
              />
            </div>

            <div>
              <Label className="text-white/50 text-xs">Agent Connections (comma-separated)</Label>
              <Input
                value={(form.agent_connections ?? []).join(", ")}
                onChange={(e) => setForm({ ...form, agent_connections: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
                className="bg-white/5 border-white/10 text-white text-sm"
                placeholder="Oz, Tom, Scarlett…"
              />
            </div>

            <div>
              <Label className="text-white/50 text-xs">Internal Description (Matt's Copy)</Label>
              <Textarea
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={8}
                className="bg-white/5 border-white/10 text-white text-sm"
              />
            </div>

            <div>
              <Label className="text-white/50 text-xs">Client Description</Label>
              <Textarea
                value={form.client_description ?? ""}
                onChange={(e) => setForm({ ...form, client_description: e.target.value })}
                rows={6}
                className="bg-white/5 border-white/10 text-white text-sm"
              />
            </div>

            {/* Step-by-step editor */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-white/50 text-xs">Step-by-Step Guide</Label>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setForm({ ...form, printable_steps: [...(form.printable_steps as any[] ?? []), { title: "", body: "", image_url: "" }] })}
                  className="text-xs border-white/10 text-white/60"
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Step
                </Button>
              </div>
              {(form.printable_steps as any[] ?? []).map((step: any, i: number) => (
                <div key={i} className="bg-white/5 border border-white/10 rounded-lg p-3 mb-2 space-y-2">
                  <div className="flex items-center gap-2">
                    <span className="text-[#00d4ff] text-xs font-bold">Step {i + 1}</span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const steps = [...(form.printable_steps as any[])];
                        steps.splice(i, 1);
                        setForm({ ...form, printable_steps: steps });
                      }}
                      className="ml-auto h-6 w-6 p-0 text-white/30 hover:text-red-400"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                  <Input
                    value={step.title}
                    onChange={(e) => {
                      const steps = [...(form.printable_steps as any[])];
                      steps[i] = { ...steps[i], title: e.target.value };
                      setForm({ ...form, printable_steps: steps });
                    }}
                    placeholder="Step title"
                    className="bg-white/5 border-white/10 text-white text-xs"
                  />
                  <Textarea
                    value={step.body}
                    onChange={(e) => {
                      const steps = [...(form.printable_steps as any[])];
                      steps[i] = { ...steps[i], body: e.target.value };
                      setForm({ ...form, printable_steps: steps });
                    }}
                    placeholder="Step description"
                    rows={2}
                    className="bg-white/5 border-white/10 text-white text-xs"
                  />
                  <Input
                    value={step.image_url ?? ""}
                    onChange={(e) => {
                      const steps = [...(form.printable_steps as any[])];
                      steps[i] = { ...steps[i], image_url: e.target.value };
                      setForm({ ...form, printable_steps: steps });
                    }}
                    placeholder="Image URL (optional)"
                    className="bg-white/5 border-white/10 text-white text-xs"
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

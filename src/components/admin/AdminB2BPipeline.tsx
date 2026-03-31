import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, Phone, Mail, Globe, Building2, ArrowRight, CheckCircle,
  Clock, AlertCircle, Search, RefreshCw, Zap,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface B2BClient {
  id: string;
  business_name: string;
  owner_name: string | null;
  email: string;
  phone: string | null;
  website: string | null;
  industry: string | null;
  city: string | null;
  state: string | null;
  stripe_customer_id: string | null;
  source: string | null;
  notes: string | null;
  created_at: string;
}

interface ServiceSubscription {
  id: string;
  client_id: string;
  service_type: string;
  stripe_subscription_id: string | null;
  status: string;
  fulfillment_stage: string;
  monthly_price: number | null;
  admin_notes: string | null;
  started_at: string;
  cancelled_at: string | null;
}

interface PipelineItem extends ServiceSubscription {
  client: B2BClient;
}

const STAGES = [
  "New Lead - Action Required",
  "Awaiting Onboarding",
  "Onboarding In Progress",
  "Active",
  "Paused",
  "Cancelled",
] as const;

const STAGE_COLORS: Record<string, string> = {
  "New Lead - Action Required": "bg-red-500/20 text-red-400 border-red-500/30",
  "Awaiting Onboarding": "bg-amber-500/20 text-amber-400 border-amber-500/30",
  "Onboarding In Progress": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  "Active": "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  "Paused": "bg-slate-500/20 text-slate-400 border-slate-500/30",
  "Cancelled": "bg-red-900/20 text-red-300 border-red-900/30",
};

const STAGE_ICONS: Record<string, React.ReactNode> = {
  "New Lead - Action Required": <AlertCircle className="w-4 h-4" />,
  "Awaiting Onboarding": <Clock className="w-4 h-4" />,
  "Onboarding In Progress": <Zap className="w-4 h-4" />,
  "Active": <CheckCircle className="w-4 h-4" />,
  "Paused": <Clock className="w-4 h-4" />,
  "Cancelled": <AlertCircle className="w-4 h-4" />,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function AdminB2BPipeline() {
  const [items, setItems] = useState<PipelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [selected, setSelected] = useState<PipelineItem | null>(null);
  const [editNotes, setEditNotes] = useState("");
  const [editStage, setEditStage] = useState("");
  const [saving, setSaving] = useState(false);
  const [view, setView] = useState<"kanban" | "table">("kanban");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const { data: subs, error: subsErr } = await (supabase.from as any)("service_subscriptions")
        .select("*")
        .order("started_at", { ascending: false });
      if (subsErr) throw subsErr;

      const { data: clients, error: clientsErr } = await (supabase.from as any)("b2b_clients")
        .select("*");
      if (clientsErr) throw clientsErr;

      const clientMap = new Map<string, B2BClient>();
      (clients || []).forEach((c: B2BClient) => clientMap.set(c.id, c));

      const pipeline: PipelineItem[] = (subs || [])
        .filter((s: ServiceSubscription) => clientMap.has(s.client_id))
        .map((s: ServiceSubscription) => ({ ...s, client: clientMap.get(s.client_id)! }));

      setItems(pipeline);
    } catch (e: any) {
      toast.error(e.message || "Failed to load pipeline");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel("b2b-pipeline")
      .on("postgres_changes", { event: "*", schema: "public", table: "service_subscriptions" }, () => fetchData())
      .on("postgres_changes", { event: "*", schema: "public", table: "b2b_clients" }, () => fetchData())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const updateSubscription = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const { error } = await (supabase.from as any)("service_subscriptions")
        .update({ fulfillment_stage: editStage, admin_notes: editNotes })
        .eq("id", selected.id);
      if (error) throw error;
      toast.success("Updated!");
      setSelected(null);
      fetchData();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const filtered = items.filter((i) => {
    const matchesSearch =
      !search ||
      i.client.business_name.toLowerCase().includes(search.toLowerCase()) ||
      i.client.email.toLowerCase().includes(search.toLowerCase()) ||
      i.service_type.toLowerCase().includes(search.toLowerCase());
    const matchesStage = stageFilter === "all" || i.fulfillment_stage === stageFilter;
    return matchesSearch && matchesStage;
  });

  // Stats
  const totalMRR = items.filter(i => i.status === "active").reduce((sum, i) => sum + (i.monthly_price || 0), 0);
  const newLeads = items.filter(i => i.fulfillment_stage === "New Lead - Action Required").length;
  const activeCount = items.filter(i => i.fulfillment_stage === "Active").length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-primary">${(totalMRR / 100).toLocaleString()}</p>
            <p className="text-xs text-muted-foreground">Monthly Revenue</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-red-400">{newLeads}</p>
            <p className="text-xs text-muted-foreground">Action Required</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-emerald-400">{activeCount}</p>
            <p className="text-xs text-muted-foreground">Active Clients</p>
          </CardContent>
        </Card>
        <Card className="bg-card border-border">
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-black text-foreground">{items.length}</p>
            <p className="text-xs text-muted-foreground">Total Subscriptions</p>
          </CardContent>
        </Card>
      </div>

      {/* Controls */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search clients..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 bg-card"
          />
        </div>
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-[220px] bg-card">
            <SelectValue placeholder="Filter by stage" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Stages</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <div className="flex gap-1 bg-card rounded-lg p-1 border border-border">
          <Button variant={view === "kanban" ? "default" : "ghost"} size="sm" onClick={() => setView("kanban")}>Kanban</Button>
          <Button variant={view === "table" ? "default" : "ghost"} size="sm" onClick={() => setView("table")}>Table</Button>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="w-4 h-4 mr-1" /> Refresh
        </Button>
      </div>

      {/* Kanban View */}
      {view === "kanban" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {STAGES.filter(s => s !== "Cancelled").map((stage) => {
            const stageItems = filtered.filter((i) => i.fulfillment_stage === stage);
            return (
              <div key={stage} className="space-y-3">
                <div className="flex items-center gap-2">
                  {STAGE_ICONS[stage]}
                  <h3 className="text-sm font-bold text-foreground">{stage}</h3>
                  <Badge variant="outline" className="ml-auto text-xs">{stageItems.length}</Badge>
                </div>
                <div className="space-y-2 min-h-[100px]">
                  {stageItems.map((item) => (
                    <Card
                      key={item.id}
                      className="bg-card border-border hover:border-primary/50 cursor-pointer transition-colors"
                      onClick={() => { setSelected(item); setEditStage(item.fulfillment_stage); setEditNotes(item.admin_notes || ""); }}
                    >
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <p className="font-bold text-sm text-foreground leading-tight">{item.client.business_name}</p>
                          <Badge className={`text-[10px] ${STAGE_COLORS[item.fulfillment_stage]}`}>
                            ${((item.monthly_price || 0) / 100).toFixed(0)}/mo
                          </Badge>
                        </div>
                        <p className="text-xs text-primary font-semibold">{item.service_type}</p>
                        <div className="flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
                          {item.client.email && (
                            <span className="flex items-center gap-1"><Mail className="w-3 h-3" />{item.client.email}</span>
                          )}
                          {item.client.phone && (
                            <span className="flex items-center gap-1"><Phone className="w-3 h-3" />{item.client.phone}</span>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {new Date(item.started_at).toLocaleDateString()}
                        </p>
                      </CardContent>
                    </Card>
                  ))}
                  {stageItems.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-8 border border-dashed border-border rounded-lg">
                      No clients
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Table View */}
      {view === "table" && (
        <Card className="bg-card border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-left p-3 font-semibold text-foreground">Business</th>
                  <th className="text-left p-3 font-semibold text-foreground">Service</th>
                  <th className="text-left p-3 font-semibold text-foreground">Stage</th>
                  <th className="text-left p-3 font-semibold text-foreground">Price</th>
                  <th className="text-left p-3 font-semibold text-foreground">Contact</th>
                  <th className="text-left p-3 font-semibold text-foreground">Date</th>
                  <th className="p-3"></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((item) => (
                  <tr key={item.id} className="border-b border-border hover:bg-muted/20 transition-colors">
                    <td className="p-3">
                      <p className="font-bold text-foreground">{item.client.business_name}</p>
                      <p className="text-xs text-muted-foreground">{item.client.owner_name}</p>
                    </td>
                    <td className="p-3">
                      <Badge variant="outline" className="text-primary border-primary/30">{item.service_type}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge className={`text-xs ${STAGE_COLORS[item.fulfillment_stage]}`}>
                        {item.fulfillment_stage}
                      </Badge>
                    </td>
                    <td className="p-3 font-semibold text-foreground">${((item.monthly_price || 0) / 100).toFixed(0)}/mo</td>
                    <td className="p-3 space-y-1">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Mail className="w-3 h-3" />{item.client.email}
                      </div>
                      {item.client.phone && (
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="w-3 h-3" />{item.client.phone}
                        </div>
                      )}
                    </td>
                    <td className="p-3 text-xs text-muted-foreground">{new Date(item.started_at).toLocaleDateString()}</td>
                    <td className="p-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setSelected(item); setEditStage(item.fulfillment_stage); setEditNotes(item.admin_notes || ""); }}
                      >
                        <ArrowRight className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {filtered.length === 0 && !loading && (
        <div className="text-center py-16 text-muted-foreground">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-semibold">No clients yet</p>
          <p className="text-sm">When someone completes a checkout, they will appear here instantly.</p>
        </div>
      )}

      {/* Detail / Edit Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{selected?.client.business_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs">Service</p>
                  <p className="font-semibold text-primary">{selected.service_type}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Monthly Price</p>
                  <p className="font-semibold">${((selected.monthly_price || 0) / 100).toFixed(0)}/mo</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Email</p>
                  <a href={`mailto:${selected.client.email}`} className="text-primary hover:underline">{selected.client.email}</a>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs">Phone</p>
                  {selected.client.phone ? (
                    <a href={`tel:${selected.client.phone}`} className="text-primary hover:underline">{selected.client.phone}</a>
                  ) : <span className="text-muted-foreground">—</span>}
                </div>
                {selected.client.website && (
                  <div className="col-span-2">
                    <p className="text-muted-foreground text-xs">Website</p>
                    <a href={selected.client.website} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-1">
                      <Globe className="w-3 h-3" />{selected.client.website}
                    </a>
                  </div>
                )}
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Fulfillment Stage</label>
                <Select value={editStage} onValueChange={setEditStage}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STAGES.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">Admin Notes</label>
                <Textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="Internal notes about this client..."
                  rows={3}
                />
              </div>

              <Button onClick={updateSubscription} disabled={saving} className="w-full">
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                Save Changes
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

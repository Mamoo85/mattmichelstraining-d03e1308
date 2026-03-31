import { memo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Building2, Mail, Phone, DollarSign, Zap, CheckCircle, Loader2,
  ChevronRight, AlertCircle, Users, TrendingUp, Copy, Check,
} from "lucide-react";
import { toast } from "sonner";

type FulfillmentStage = "New Lead - Action Required" | "Onboarding" | "Active" | "Paused" | "Cancelled";

interface B2BClient {
  id: string;
  business_name: string;
  owner_name: string | null;
  email: string;
  phone: string | null;
  service_type: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  fulfillment_stage: FulfillmentStage;
  notes: string | null;
  active: boolean;
  created_at: string;
}

const STAGES: { key: FulfillmentStage; label: string; color: string; icon: typeof Zap }[] = [
  { key: "New Lead - Action Required", label: "New Lead",    color: "bg-red-500/20 text-red-300 border-red-500/30",      icon: AlertCircle },
  { key: "Onboarding",                 label: "Onboarding",  color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", icon: Zap },
  { key: "Active",                     label: "Active",      color: "bg-green-500/20 text-green-300 border-green-500/30",  icon: CheckCircle },
  { key: "Paused",                     label: "Paused",      color: "bg-slate-500/20 text-slate-300 border-slate-500/30",  icon: AlertCircle },
  { key: "Cancelled",                  label: "Cancelled",   color: "bg-red-900/20 text-red-400 border-red-900/30",         icon: AlertCircle },
];

function stageBadge(stage: string) {
  const s = STAGES.find((s) => s.key === stage);
  return s ? (
    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${s.color}`}>{stage}</Badge>
  ) : (
    <Badge variant="outline" className="text-[10px]">{stage}</Badge>
  );
}

const AdminAgencyCRM = memo(() => {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<B2BClient | null>(null);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [serviceFilter, setServiceFilter] = useState<string>("all");

  const { data: clients = [], isLoading } = useQuery<B2BClient[]>({
    queryKey: ["b2b-clients"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("b2b_clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30_000,
  });

  const stageMutation = useMutation({
    mutationFn: async ({ id, stage }: { id: string; stage: FulfillmentStage }) => {
      const { error } = await (supabase as any)
        .from("b2b_clients")
        .update({ fulfillment_stage: stage, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["b2b-clients"] });
      toast.success("Stage updated");
    },
    onError: () => toast.error("Update failed"),
  });

  const saveNotes = async () => {
    if (!selected) return;
    setSavingNotes(true);
    try {
      const { error } = await (supabase as any)
        .from("b2b_clients")
        .update({ notes, updated_at: new Date().toISOString() })
        .eq("id", selected.id);
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["b2b-clients"] });
      toast.success("Notes saved");
    } catch { toast.error("Save failed"); }
    finally { setSavingNotes(false); }
  };

  const copy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 2000);
  };

  // Stats
  const actionNeeded = clients.filter((c) => c.fulfillment_stage === "New Lead - Action Required").length;
  const active = clients.filter((c) => c.fulfillment_stage === "Active").length;
  const services = [...new Set(clients.map((c) => c.service_type))].sort();

  // Filters
  const filtered = clients.filter((c) => {
    if (stageFilter !== "all" && c.fulfillment_stage !== stageFilter) return false;
    if (serviceFilter !== "all" && c.service_type !== serviceFilter) return false;
    return true;
  });

  // Group by stage for kanban
  const byStage = (stage: FulfillmentStage) =>
    filtered.filter((c) => c.fulfillment_stage === stage);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#e8621a]/10 flex items-center justify-center">
            <Building2 size={18} className="text-[#e8621a]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Agency Fulfillment CRM</h2>
            <p className="text-sm text-slate-400">Every paid subscription, the moment it clears</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
          Live — refreshes every 30s
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Clients", value: clients.length, icon: Users, color: "text-slate-300" },
          { label: "Action Required", value: actionNeeded, icon: AlertCircle, color: "text-red-400" },
          { label: "Active", value: active, icon: CheckCircle, color: "text-green-400" },
          { label: "Services", value: services.length, icon: TrendingUp, color: "text-[#e8621a]" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label} className="bg-slate-900 border-slate-700">
            <CardContent className="p-4 flex items-center gap-3">
              <Icon size={20} className={color} />
              <div>
                <p className="text-xl font-black text-white">{value}</p>
                <p className="text-xs text-slate-500">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <Select value={stageFilter} onValueChange={setStageFilter}>
          <SelectTrigger className="w-52 bg-slate-800 border-slate-600 text-white text-sm">
            <SelectValue placeholder="Filter by stage" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-white">All Stages</SelectItem>
            {STAGES.map((s) => (
              <SelectItem key={s.key} value={s.key} className="text-white">{s.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={serviceFilter} onValueChange={setServiceFilter}>
          <SelectTrigger className="w-60 bg-slate-800 border-slate-600 text-white text-sm">
            <SelectValue placeholder="Filter by service" />
          </SelectTrigger>
          <SelectContent className="bg-slate-800 border-slate-700">
            <SelectItem value="all" className="text-white">All Services</SelectItem>
            {services.map((s) => (
              <SelectItem key={s} value={s} className="text-white">{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {STAGES.slice(0, 4).map((s) => (
            <div key={s.key} className="bg-slate-900 rounded-xl border border-slate-700 p-3 space-y-2 animate-pulse">
              <div className="h-4 bg-slate-700 rounded w-3/4" />
              {[0, 1].map((i) => <div key={i} className="h-20 bg-slate-800 rounded-lg" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-start">
          {STAGES.filter((s) => s.key !== "Cancelled").map((col) => {
            const colClients = byStage(col.key);
            const Icon = col.icon;
            return (
              <div key={col.key} className="bg-slate-900 rounded-xl border border-slate-700 flex flex-col">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700">
                  <div className="flex items-center gap-1.5">
                    <Icon size={13} className={col.color.split(" ")[1]} />
                    <span className="text-xs font-semibold text-slate-300">{col.label}</span>
                  </div>
                  <span className="text-xs font-bold text-slate-500">{colClients.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[100px]">
                  {colClients.length === 0 && (
                    <p className="text-xs text-slate-600 text-center py-6">Empty</p>
                  )}
                  {colClients.map((client) => (
                    <button
                      key={client.id}
                      onClick={() => { setSelected(client); setNotes(client.notes || ""); }}
                      className="w-full text-left rounded-lg border border-slate-700 bg-slate-800 hover:border-[#e8621a]/40 p-3 space-y-1.5 transition-colors"
                    >
                      <p className="text-sm font-semibold text-white leading-tight line-clamp-1">
                        {client.business_name}
                      </p>
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-[#e8621a]/40 text-[#e8621a]">
                        {client.service_type}
                      </Badge>
                      <p className="text-xs text-slate-500">
                        {new Date(client.created_at).toLocaleDateString()}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Client Detail Modal */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white">{selected?.business_name}</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-5 mt-2">
              {/* Stage selector */}
              <div className="space-y-1.5">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Fulfillment Stage</p>
                <Select
                  value={selected.fulfillment_stage}
                  onValueChange={(val) => {
                    stageMutation.mutate({ id: selected.id, stage: val as FulfillmentStage });
                    setSelected({ ...selected, fulfillment_stage: val as FulfillmentStage });
                  }}
                >
                  <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {STAGES.map((s) => (
                      <SelectItem key={s.key} value={s.key} className="text-white">{s.key}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Client info */}
              <div className="bg-slate-800 rounded-lg p-4 space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Service</span>
                  <Badge variant="outline" className="text-[#e8621a] border-[#e8621a]/40 text-xs">
                    {selected.service_type}
                  </Badge>
                </div>
                {selected.owner_name && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Owner</span>
                    <span className="text-white">{selected.owner_name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Email</span>
                  <div className="flex items-center gap-1.5">
                    <a href={`mailto:${selected.email}`} className="text-[#e8621a] hover:underline text-xs">{selected.email}</a>
                    <button onClick={() => copy(selected.email, "email")} className="text-slate-500 hover:text-white">
                      {copied === "email" ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    </button>
                  </div>
                </div>
                {selected.phone && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Phone</span>
                    <div className="flex items-center gap-1.5">
                      <a href={`tel:${selected.phone}`} className="text-white hover:underline text-xs">{selected.phone}</a>
                      <button onClick={() => copy(selected.phone!, "phone")} className="text-slate-500 hover:text-white">
                        {copied === "phone" ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Signed up</span>
                  <span className="text-slate-300 text-xs">{new Date(selected.created_at).toLocaleString()}</span>
                </div>
                {selected.stripe_subscription_id && (
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Subscription</span>
                    <a
                      href={`https://dashboard.stripe.com/subscriptions/${selected.stripe_subscription_id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[#e8621a] text-xs hover:underline"
                    >
                      View in Stripe &rarr;
                    </a>
                  </div>
                )}
              </div>

              {/* Quick actions */}
              <div className="flex gap-2">
                <a
                  href={`mailto:${selected.email}?subject=Welcome to ${selected.service_type} — Next Steps`}
                  className="flex-1"
                >
                  <Button variant="outline" size="sm" className="w-full border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800">
                    <Mail size={13} className="mr-1.5" /> Email Client
                  </Button>
                </a>
                {selected.phone && (
                  <a href={`tel:${selected.phone}`} className="flex-1">
                    <Button variant="outline" size="sm" className="w-full border-slate-600 text-slate-300 hover:text-white hover:bg-slate-800">
                      <Phone size={13} className="mr-1.5" /> Call
                    </Button>
                  </a>
                )}
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Notes</p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Onboarding notes, preferences, follow-up reminders..."
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500 text-sm min-h-[80px]"
                />
                <Button
                  onClick={saveNotes}
                  disabled={savingNotes}
                  size="sm"
                  className="bg-[#e8621a] hover:bg-[#d4551a] text-white"
                >
                  {savingNotes ? <Loader2 size={13} className="animate-spin mr-1.5" /> : null}
                  Save Notes
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});

AdminAgencyCRM.displayName = "AdminAgencyCRM";
export default AdminAgencyCRM;

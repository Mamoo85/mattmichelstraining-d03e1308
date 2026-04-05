import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import {
  ChevronDown, ChevronRight, CheckCircle2, Circle,
  Mail, ExternalLink, Copy, Phone, Globe, AlertCircle, Loader2
} from "lucide-react";
import { getGuide, AUTO_PRODUCTS } from "@/lib/fulfillment-guides";
import type { FulfillmentStep, ProductGuide } from "@/lib/fulfillment-guides";
import { AdminHelpCard } from "./AdminHelpCard";
import { getAdminGuide } from "@/lib/admin-guides";

interface ClientRow {
  sub_id: string;
  client_id: string;
  email: string;
  business_name: string;
  phone: string | null;
  website: string | null;
  service_type: string;
  fulfillment_stage: string;
  monthly_price: number | null;
  admin_notes: string | null;
  started_at: string;
}

/* Guides imported from shared module — see src/lib/fulfillment-guides.ts */

/* ── Helpers ────────────────────────────────────────────────── */
function fmtPrice(cents: number | null) {
  if (!cents) return "";
  return `$${(cents / 100).toFixed(0)}/mo`;
}

function stageColor(stage: string) {
  if (stage.includes("✅")) return "bg-green-500/15 text-green-400 border-green-500/30";
  if (stage.includes("🧪")) return "bg-blue-500/15 text-blue-400 border-blue-500/30";
  if (stage.includes("⚙️")) return "bg-yellow-500/15 text-yellow-400 border-yellow-500/30";
  if (stage.includes("📧")) return "bg-purple-500/15 text-purple-400 border-purple-500/30";
  return "bg-orange-500/15 text-orange-400 border-orange-500/30";
}

/* ── Step Component ─────────────────────────────────────────── */
function StepRow({
  step, index, isDone, client,
  onComplete, onFieldSave,
}: {
  step: FulfillmentStep;
  index: number;
  isDone: boolean;
  client: ClientRow;
  onComplete: (stage: string) => void;
  onFieldSave: (field: "phone" | "website" | "notes", value: string) => Promise<void>;
}) {
  const [fieldValue, setFieldValue] = useState("");
  const [saving, setSaving] = useState(false);

  const mailtoHref = step.emailSubject
    ? `mailto:${client.email}?subject=${encodeURIComponent(step.emailSubject)}&body=${encodeURIComponent((step.emailBody ?? "").replace("[NAME]", client.business_name))}`
    : "#";

  const handleFieldSave = async () => {
    if (!fieldValue.trim() || !step.dbField) return;
    setSaving(true);
    await onFieldSave(step.dbField, fieldValue.trim());
    setSaving(false);
    onComplete(step.nextStage);
  };

  return (
    <div className={`flex gap-3 p-3 rounded-xl border transition-all ${isDone ? "opacity-40 border-white/5" : "border-white/10 bg-white/2"}`}>
      <div className="mt-0.5 shrink-0">
        {isDone
          ? <CheckCircle2 size={16} className="text-green-500" />
          : <Circle size={16} className="text-white/20" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-bold text-white/80 mb-0.5">
          {index + 1}. {step.label}
        </p>
        <p className="text-[11px] text-white/40 mb-2 leading-relaxed">{step.description}</p>

        {!isDone && (
          <div className="flex flex-wrap gap-2">
            {/* Email button */}
            {step.action === "send_email" && (
              <a
                href={mailtoHref}
                onClick={() => setTimeout(() => onComplete(step.nextStage), 1500)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
              >
                <Mail size={11} /> Send Email
              </a>
            )}

            {/* External link */}
            {step.checkUrl && (
              <a
                href={step.checkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 text-white/70 text-[10px] font-bold uppercase tracking-widest hover:bg-white/12 transition-all"
              >
                <ExternalLink size={11} /> {step.checkText ?? "Open Link"}
              </a>
            )}

            {/* Navigate button */}
            {step.action === "navigate" && step.navigateTo && (
              <a
                href={step.navigateTo}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 text-white/70 text-[10px] font-bold uppercase tracking-widest hover:bg-white/12 transition-all"
              >
                <ExternalLink size={11} /> {step.navigateText ?? "Go There"}
              </a>
            )}

            {/* Check website */}
            {step.action === "check_website" && client.website && (
              <a
                href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/8 text-white/70 text-[10px] font-bold uppercase tracking-widest hover:bg-white/12 transition-all"
              >
                <Globe size={11} /> Visit Their Site
              </a>
            )}

            {/* Field input */}
            {step.action === "field_input" && step.dbField && (
              <div className="flex gap-2 w-full mt-1">
                <Input
                  value={fieldValue}
                  onChange={e => setFieldValue(e.target.value)}
                  placeholder={step.fieldPlaceholder}
                  className="h-8 text-xs bg-white/5 border-white/10 text-white"
                />
                <Button
                  size="sm"
                  onClick={handleFieldSave}
                  disabled={saving || !fieldValue.trim()}
                  className="h-8 text-[10px] px-3 shrink-0"
                >
                  {saving ? <Loader2 size={11} className="animate-spin" /> : "Save"}
                </Button>
              </div>
            )}

            {/* Manual check / complete */}
            {(step.action === "manual_check" || step.action === "complete") && (
              <button
                onClick={() => onComplete(step.nextStage)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-[10px] font-bold uppercase tracking-widest hover:bg-green-500/25 transition-all border border-green-500/20"
              >
                <CheckCircle2 size={11} /> {step.checkText ?? "Mark Done"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Client Card ────────────────────────────────────────────── */
function ClientCard({ client, onStageUpdate }: { client: ClientRow; onStageUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const guide = getGuide(client.service_type);

  // Determine which step index we're on based on current stage
  const currentStepIndex = (() => {
    if (client.fulfillment_stage === "✅ Active") return guide.steps.length;
    if (client.fulfillment_stage === "New Lead - Action Required") return 0;
    // Find the step whose nextStage matches current stage
    const idx = guide.steps.findIndex(s => s.nextStage === client.fulfillment_stage);
    return idx === -1 ? 0 : idx + 1;
  })();

  const isActive = client.fulfillment_stage === "✅ Active";

  const handleStageUpdate = async (newStage: string) => {
    setSaving(true);
    const { error } = await supabase
      .from("service_subscriptions" as any)
      .update({ fulfillment_stage: newStage, updated_at: new Date().toISOString() })
      .eq("id", client.sub_id);
    setSaving(false);
    if (error) {
      toast({ title: "Error saving stage", description: error.message, variant: "destructive" });
    } else {
      toast({ title: newStage.includes("✅") ? "✅ Marked Active!" : "Stage updated", description: newStage });
      onStageUpdate();
    }
  };

  const handleFieldSave = async (field: "phone" | "website" | "notes", value: string) => {
    const { error } = await supabase
      .from("b2b_clients" as any)
      .update({ [field]: value, updated_at: new Date().toISOString() })
      .eq("id", client.client_id);
    if (error) throw error;
    toast({ title: "Saved!", description: `${field} updated` });
  };

  return (
    <div className={`rounded-2xl border transition-all ${isActive ? "border-green-500/20 bg-green-500/5" : "border-white/10 bg-white/2"}`}>
      {/* Header row */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center gap-3 p-4 text-left"
      >
        <span className="text-xl shrink-0">{guide.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white truncate">{client.business_name}</span>
            {client.monthly_price && (
              <span className="text-[10px] text-white/40">{fmtPrice(client.monthly_price)}</span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <span className="text-[10px] text-white/40">{client.email}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-bold ${stageColor(client.fulfillment_stage)}`}>
              {client.fulfillment_stage}
            </span>
          </div>
        </div>
        <div className="shrink-0 flex items-center gap-2">
          {saving && <Loader2 size={14} className="animate-spin text-white/40" />}
          {!isActive && (
            <span className="text-[10px] text-white/30">
              {currentStepIndex}/{guide.steps.length} steps
            </span>
          )}
          {expanded ? <ChevronDown size={14} className="text-white/40" /> : <ChevronRight size={14} className="text-white/40" />}
        </div>
      </button>

      {/* Steps */}
      {expanded && guide.needsSetup && (
        <div className="px-4 pb-4 space-y-2 border-t border-white/5 pt-3">
          {/* Quick contact row */}
          <div className="flex gap-2 mb-3 flex-wrap">
            <a
              href={`mailto:${client.email}`}
              className="inline-flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors"
            >
              <Mail size={11} /> {client.email}
            </a>
            {client.phone && (
              <a
                href={`tel:${client.phone}`}
                className="inline-flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors"
              >
                <Phone size={11} /> {client.phone}
              </a>
            )}
            {client.website && (
              <a
                href={client.website.startsWith("http") ? client.website : `https://${client.website}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-white/40 hover:text-white/70 transition-colors"
              >
                <Globe size={11} /> {client.website}
              </a>
            )}
          </div>

          {guide.steps.map((step, i) => (
            <StepRow
              key={i}
              step={step}
              index={i}
              isDone={i < currentStepIndex}
              client={client}
              onComplete={handleStageUpdate}
              onFieldSave={handleFieldSave}
            />
          ))}

          {isActive && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
              <CheckCircle2 size={16} className="text-green-400" />
              <span className="text-xs text-green-400 font-bold">All steps complete — running automatically</span>
            </div>
          )}
        </div>
      )}

      {expanded && !guide.needsSetup && (
        <div className="px-4 pb-4 border-t border-white/5 pt-3">
          <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/10 border border-green-500/20">
            <CheckCircle2 size={16} className="text-green-400" />
            <span className="text-xs text-green-400 font-bold">100% automated — no setup required</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main Component ─────────────────────────────────────────── */
export default function AdminFulfillment() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"needs_action" | "in_progress" | "active" | "all">("needs_action");

  const load = async () => {
    setLoading(true);
    const { data, error } = await (supabase as any)
      .from("service_subscriptions")
      .select(`
        id,
        client_id,
        service_type,
        fulfillment_stage,
        monthly_price,
        admin_notes,
        started_at,
        b2b_clients!inner (
          email,
          business_name,
          phone,
          website
        )
      `)
      .order("started_at", { ascending: false });

    if (error) {
      toast({ title: "Error loading fulfillment data", description: error.message, variant: "destructive" });
      setLoading(false);
      return;
    }

    const rows: ClientRow[] = (data ?? []).map((r: any) => ({
      sub_id: r.id,
      client_id: r.client_id,
      email: r.b2b_clients?.email ?? "",
      business_name: r.b2b_clients?.business_name ?? r.b2b_clients?.email ?? "Unknown",
      phone: r.b2b_clients?.phone ?? null,
      website: r.b2b_clients?.website ?? null,
      service_type: r.service_type,
      fulfillment_stage: r.fulfillment_stage ?? "New Lead - Action Required",
      monthly_price: r.monthly_price,
      admin_notes: r.admin_notes,
      started_at: r.started_at,
    }));

    setClients(rows);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const needsAction = clients.filter(c => c.fulfillment_stage === "New Lead - Action Required");
  const inProgress = clients.filter(c =>
    c.fulfillment_stage !== "New Lead - Action Required" &&
    c.fulfillment_stage !== "✅ Active"
  );
  const active = clients.filter(c => c.fulfillment_stage === "✅ Active");

  const filtered = filter === "needs_action" ? needsAction
    : filter === "in_progress" ? inProgress
    : filter === "active" ? active
    : clients;

  const guide = getAdminGuide("fulfillment");

  return (
    <div className="space-y-4">
      {guide && <AdminHelpCard id={guide.id} title={guide.title} body={guide.body} tips={guide.tips} scenarios={guide.scenarios} whenSomeoneBuys={guide.whenSomeoneBuys} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-black uppercase tracking-widest text-white">Fulfillment Hub</h2>
          <p className="text-[11px] text-white/40 mt-0.5">Click a customer → follow the steps → done</p>
        </div>
        <button
          onClick={load}
          className="text-[10px] text-white/30 hover:text-white/60 uppercase tracking-widest font-bold transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-3 gap-2">
        <div className="flex items-center gap-2 p-3 rounded-xl bg-green-500/8 border border-green-500/20">
          <CheckCircle2 size={14} className="text-green-400" />
          <div>
            <span className="text-lg font-black text-green-400">{active.length}</span>
            <span className="text-[9px] text-white/40 ml-1.5 uppercase tracking-widest">Active</span>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-xl bg-blue-500/8 border border-blue-500/20">
          <Loader2 size={14} className="text-blue-400" />
          <div>
            <span className="text-lg font-black text-blue-400">{inProgress.length}</span>
            <span className="text-[9px] text-white/40 ml-1.5 uppercase tracking-widest">Onboarding</span>
          </div>
        </div>
        <div className="flex items-center gap-2 p-3 rounded-xl bg-orange-500/8 border border-orange-500/20">
          <AlertCircle size={14} className="text-orange-400" />
          <div>
            <span className="text-lg font-black text-orange-400">{needsAction.length}</span>
            <span className="text-[9px] text-white/40 ml-1.5 uppercase tracking-widest">Need Action</span>
          </div>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-white/4 rounded-full p-1 w-fit">
        {([
          { key: "needs_action", label: "Needs Action", count: needsAction.length, color: "text-orange-400" },
          { key: "in_progress", label: "In Progress", count: inProgress.length, color: "text-blue-400" },
          { key: "active", label: "Active", count: active.length, color: "text-green-400" },
          { key: "all", label: "All", count: clients.length, color: "text-white/60" },
        ] as const).map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${
              filter === tab.key ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60"
            }`}
          >
            {tab.label}
            {tab.count > 0 && (
              <span className={`text-[9px] font-black ${tab.color}`}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Alert for new items */}
      {needsAction.length > 0 && filter === "needs_action" && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-orange-500/10 border border-orange-500/20">
          <AlertCircle size={14} className="text-orange-400 shrink-0" />
          <p className="text-xs text-orange-400 font-bold">
            {needsAction.length} customer{needsAction.length !== 1 ? "s" : ""} need{needsAction.length === 1 ? "s" : ""} action now — click to start setup
          </p>
        </div>
      )}

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-white/30" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-white/30 text-sm">
          {filter === "needs_action" ? "🎉 Nothing needs action right now" : "No customers in this stage"}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(client => (
            <ClientCard
              key={client.sub_id}
              client={client}
              onStageUpdate={load}
            />
          ))}
        </div>
      )}
    </div>
  );
}

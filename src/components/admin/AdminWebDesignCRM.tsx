import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  Plus,
  Phone,
  Mail,
  ArrowRight,
  FileText,
  Loader2,
  CheckCircle,
  Globe,
  DollarSign,
  Pencil,
  X,
  Copy,
  ExternalLink,
} from "lucide-react";

// ─── Types ───────────────────────────────────────────────────────────────────

type LeadStatus =
  | "new"
  | "in_talks"
  | "proposal_out"
  | "building"
  | "live"
  | "closed";

interface WebDesignLead {
  id: string;
  created_at: string;
  name: string;
  business: string;
  phone: string;
  email: string;
  description: string;
  status: LeadStatus;
  proposal_url: string | null;
  monthly_retainer: boolean;
  site_url: string | null;
  notes: string | null;
  build_fee_paid: boolean;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_ORDER: LeadStatus[] = [
  "new",
  "in_talks",
  "proposal_out",
  "building",
  "live",
  "closed",
];

const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New Leads",
  in_talks: "In Talks",
  proposal_out: "Proposal Out",
  building: "Building",
  live: "Live",
  closed: "Closed / Lost",
};

const STATUS_COLORS: Record<LeadStatus, string> = {
  new: "bg-slate-500/20 text-slate-300 border-slate-500/30",
  in_talks: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  proposal_out: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  building: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  live: "bg-green-500/20 text-green-400 border-green-500/30",
  closed: "bg-red-500/20 text-red-400 border-red-500/30",
};

const EMPTY_FORM = {
  name: "",
  business: "",
  phone: "",
  email: "",
  description: "",
  status: "new" as LeadStatus,
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function nextStatus(current: LeadStatus): LeadStatus | null {
  const idx = STATUS_ORDER.indexOf(current);
  if (idx === -1 || idx === STATUS_ORDER.length - 1) return null;
  return STATUS_ORDER[idx + 1];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

interface LeadCardProps {
  lead: WebDesignLead;
  onMoveStage: (lead: WebDesignLead) => void;
  onEdit: (lead: WebDesignLead) => void;
  onMarkPaid: (lead: WebDesignLead) => void;
  onGenerateProposal: (lead: WebDesignLead) => void;
  onSaveNotes: (lead: WebDesignLead, notes: string) => void;
}

function LeadCard({
  lead,
  onMoveStage,
  onEdit,
  onMarkPaid,
  onGenerateProposal,
  onSaveNotes,
}: LeadCardProps) {
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesValue, setNotesValue] = useState(lead.notes ?? "");

  const next = nextStatus(lead.status);

  function handleNotesSave() {
    onSaveNotes(lead, notesValue);
    setEditingNotes(false);
  }

  return (
    <Card className="bg-card border border-border/60 hover:border-border transition-colors">
      <CardContent className="p-4 space-y-3">
        {/* Header row */}
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{lead.business}</p>
            <p className="text-xs text-muted-foreground truncate">{lead.name}</p>
          </div>
          <Badge
            variant="outline"
            className={`text-xs shrink-0 ${STATUS_COLORS[lead.status]}`}
          >
            {STATUS_LABELS[lead.status]}
          </Badge>
        </div>

        {/* Contact info */}
        <div className="space-y-1">
          {lead.phone && (
            <a
              href={`tel:${lead.phone}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Phone className="w-3 h-3 shrink-0" />
              <span>{lead.phone}</span>
            </a>
          )}
          {lead.email && (
            <a
              href={`mailto:${lead.email}`}
              className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Mail className="w-3 h-3 shrink-0" />
              <span className="truncate">{lead.email}</span>
            </a>
          )}
        </div>

        {/* Description */}
        {lead.description && (
          <p className="text-xs text-muted-foreground line-clamp-2">
            {lead.description}
          </p>
        )}

        {/* Site URL */}
        {lead.site_url && (
          <a
            href={lead.site_url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-green-400 hover:text-green-300 transition-colors"
          >
            <Globe className="w-3 h-3 shrink-0" />
            <span className="truncate">{lead.site_url}</span>
            <ExternalLink className="w-3 h-3 shrink-0" />
          </a>
        )}

        {/* Status flags */}
        <div className="flex flex-wrap gap-2">
          {lead.build_fee_paid && (
            <span className="flex items-center gap-1 text-xs text-green-400">
              <CheckCircle className="w-3 h-3" /> Build Fee Paid
            </span>
          )}
          {lead.monthly_retainer && (
            <span className="flex items-center gap-1 text-xs text-blue-400">
              <DollarSign className="w-3 h-3" /> On Retainer
            </span>
          )}
        </div>

        {/* Notes */}
        <div className="space-y-1">
          {editingNotes ? (
            <div className="space-y-1.5">
              <Textarea
                value={notesValue}
                onChange={(e) => setNotesValue(e.target.value)}
                placeholder="Add notes..."
                className="text-xs min-h-[64px] resize-none"
                autoFocus
              />
              <div className="flex gap-1.5">
                <Button size="sm" className="h-6 text-xs px-2" onClick={handleNotesSave}>
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-xs px-2"
                  onClick={() => {
                    setNotesValue(lead.notes ?? "");
                    setEditingNotes(false);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setEditingNotes(true)}
              className="w-full text-left text-xs text-muted-foreground hover:text-foreground transition-colors min-h-[1.25rem]"
            >
              {lead.notes ? (
                <span className="line-clamp-2">{lead.notes}</span>
              ) : (
                <span className="italic opacity-50">Click to add notes…</span>
              )}
            </button>
          )}
        </div>

        {/* Footer: date + actions */}
        <div className="flex items-center justify-between pt-1 border-t border-border/40">
          <span className="text-xs text-muted-foreground">
            {formatDate(lead.created_at)}
          </span>
          <div className="flex items-center gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              title="Generate Proposal"
              onClick={() => onGenerateProposal(lead)}
            >
              <FileText className="w-3.5 h-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              title="Edit lead"
              onClick={() => onEdit(lead)}
            >
              <Pencil className="w-3.5 h-3.5" />
            </Button>
            {!lead.build_fee_paid && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-green-400 hover:text-green-300"
                title="Mark build fee paid"
                onClick={() => onMarkPaid(lead)}
              >
                <CheckCircle className="w-3.5 h-3.5" />
              </Button>
            )}
            {next && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-blue-400 hover:text-blue-300"
                title={`Move to ${STATUS_LABELS[next]}`}
                onClick={() => onMoveStage(lead)}
              >
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminWebDesignCRM() {
  const [leads, setLeads] = useState<WebDesignLead[]>([]);
  const [loading, setLoading] = useState(true);

  // Modal state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editLead, setEditLead] = useState<WebDesignLead | null>(null);
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  // Proposal modal
  const [proposalLead, setProposalLead] = useState<WebDesignLead | null>(null);
  const [proposalText, setProposalText] = useState("");
  const [generatingProposal, setGeneratingProposal] = useState(false);

  // ── Load leads ─────────────────────────────────────────────────────────────

  async function loadLeads() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("web_design_leads" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setLeads((data ?? []) as unknown as WebDesignLead[]);
    } catch (e: any) {
      toast.error("Failed to load leads: " + e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadLeads();
  }, []);

  // ── Revenue summary ────────────────────────────────────────────────────────

  const activeClients = leads.filter((l) => l.status === "live");
  const mrr = activeClients.length * 49;
  const proposalOut = leads.filter((l) => l.status === "proposal_out");
  const pipelineValue = proposalOut.length * (499 + 49);
  const totalBuilt = leads.filter(
    (l) => l.status === "live" || l.status === "building" || l.status === "closed"
  ).length;

  // ── Helpers ────────────────────────────────────────────────────────────────

  function openAddModal() {
    setFormData(EMPTY_FORM);
    setEditLead(null);
    setShowAddModal(true);
  }

  function openEditModal(lead: WebDesignLead) {
    setFormData({
      name: lead.name,
      business: lead.business,
      phone: lead.phone,
      email: lead.email,
      description: lead.description,
      status: lead.status,
    });
    setEditLead(lead);
    setShowAddModal(true);
  }

  function closeModal() {
    setShowAddModal(false);
    setEditLead(null);
    setFormData(EMPTY_FORM);
  }

  // ── CRUD ───────────────────────────────────────────────────────────────────

  async function handleSaveLead() {
    if (!formData.name.trim() || !formData.business.trim()) {
      toast.error("Name and business are required.");
      return;
    }
    setSaving(true);
    try {
      if (editLead) {
        const { error } = await supabase
          .from("web_design_leads" as any)
          .update({
            name: formData.name.trim(),
            business: formData.business.trim(),
            phone: formData.phone.trim(),
            email: formData.email.trim(),
            description: formData.description.trim(),
            status: formData.status,
          })
          .eq("id", editLead.id);
        if (error) throw error;
        toast.success("Lead updated.");
      } else {
        const { error } = await supabase
          .from("web_design_leads" as any)
          .insert({
            name: formData.name.trim(),
            business: formData.business.trim(),
            phone: formData.phone.trim(),
            email: formData.email.trim(),
            description: formData.description.trim(),
            status: formData.status,
            monthly_retainer: false,
            build_fee_paid: false,
          });
        if (error) throw error;
        toast.success("Lead added.");
      }
      closeModal();
      await loadLeads();
    } catch (e: any) {
      toast.error("Save failed: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleMoveStage(lead: WebDesignLead) {
    const next = nextStatus(lead.status);
    if (!next) return;
    try {
      const { error } = await supabase
        .from("web_design_leads" as any)
        .update({ status: next })
        .eq("id", lead.id);
      if (error) throw error;
      toast.success(`Moved to ${STATUS_LABELS[next]}`);
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, status: next } : l))
      );
    } catch (e: any) {
      toast.error("Failed to update stage: " + e.message);
    }
  }

  async function handleMarkPaid(lead: WebDesignLead) {
    try {
      const { error } = await supabase
        .from("web_design_leads" as any)
        .update({ build_fee_paid: true })
        .eq("id", lead.id);
      if (error) throw error;
      toast.success("Build fee marked as paid.");
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, build_fee_paid: true } : l))
      );
    } catch (e: any) {
      toast.error("Failed to mark paid: " + e.message);
    }
  }

  async function handleSaveNotes(lead: WebDesignLead, notes: string) {
    try {
      const { error } = await supabase
        .from("web_design_leads" as any)
        .update({ notes })
        .eq("id", lead.id);
      if (error) throw error;
      toast.success("Notes saved.");
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, notes } : l))
      );
    } catch (e: any) {
      toast.error("Failed to save notes: " + e.message);
    }
  }

  // ── Proposal generation ────────────────────────────────────────────────────

  async function handleGenerateProposal(lead: WebDesignLead) {
    setProposalLead(lead);
    setProposalText("");
    setGeneratingProposal(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "generate-web-proposal",
        {
          body: {
            name: lead.name,
            business: lead.business,
            description: lead.description,
            phone: lead.phone,
            email: lead.email,
          },
        }
      );
      if (error) throw error;
      const text =
        data?.proposal ?? data?.text ?? data?.content ?? JSON.stringify(data);
      setProposalText(text);
    } catch (e: any) {
      toast.error("Proposal generation failed: " + e.message);
      setProposalLead(null);
    } finally {
      setGeneratingProposal(false);
    }
  }

  function copyProposal() {
    navigator.clipboard.writeText(proposalText).then(() => {
      toast.success("Proposal copied to clipboard.");
    });
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const leadsForStatus = (status: LeadStatus) =>
    leads.filter((l) => l.status === status);

  return (
    <div className="space-y-6 p-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Web Design CRM</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Lead pipeline and client tracker for your web design business
          </p>
        </div>
        <Button onClick={openAddModal} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Lead
        </Button>
      </div>

      {/* Revenue summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-card border border-border/60">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Active Clients
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold">{activeClients.length}</p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border/60">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Monthly Recurring
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold text-green-400">
              ${mrr.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              {activeClients.length} × $49/mo
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border/60">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Pipeline Value
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold text-yellow-400">
              ${pipelineValue.toLocaleString()}
            </p>
            <p className="text-xs text-muted-foreground">
              {proposalOut.length} proposal{proposalOut.length !== 1 ? "s" : ""} out
            </p>
          </CardContent>
        </Card>

        <Card className="bg-card border border-border/60">
          <CardHeader className="pb-1 pt-4 px-4">
            <CardTitle className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
              Projects Built
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <p className="text-3xl font-bold text-purple-400">{totalBuilt}</p>
            <p className="text-xs text-muted-foreground">all time</p>
          </CardContent>
        </Card>
      </div>

      {/* Pipeline tabs */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <Tabs defaultValue="new">
          <TabsList className="flex-wrap h-auto gap-1 bg-muted/40 p-1">
            {STATUS_ORDER.map((status) => {
              const count = leadsForStatus(status).length;
              return (
                <TabsTrigger
                  key={status}
                  value={status}
                  className="gap-1.5 text-xs"
                >
                  {STATUS_LABELS[status]}
                  {count > 0 && (
                    <span className="ml-1 rounded-full bg-primary/20 text-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none">
                      {count}
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {STATUS_ORDER.map((status) => {
            const statusLeads = leadsForStatus(status);
            return (
              <TabsContent key={status} value={status} className="mt-4">
                {statusLeads.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
                    <p className="text-sm">No leads in this stage.</p>
                    {status === "new" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="mt-2 gap-1.5"
                        onClick={openAddModal}
                      >
                        <Plus className="w-3.5 h-3.5" /> Add your first lead
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {statusLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        onMoveStage={handleMoveStage}
                        onEdit={openEditModal}
                        onMarkPaid={handleMarkPaid}
                        onGenerateProposal={handleGenerateProposal}
                        onSaveNotes={handleSaveNotes}
                      />
                    ))}
                  </div>
                )}
              </TabsContent>
            );
          })}
        </Tabs>
      )}

      {/* ── Add / Edit Lead Modal ───────────────────────────────────────────── */}
      <Dialog open={showAddModal} onOpenChange={(open) => !open && closeModal()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editLead ? "Edit Lead" : "Add New Lead"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Contact Name *
                </label>
                <Input
                  placeholder="Jane Smith"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Business Name *
                </label>
                <Input
                  placeholder="Smith Plumbing"
                  value={formData.business}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, business: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Phone
                </label>
                <Input
                  placeholder="313-555-0100"
                  value={formData.phone}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, phone: e.target.value }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Email
                </label>
                <Input
                  placeholder="jane@smithplumbing.com"
                  value={formData.email}
                  onChange={(e) =>
                    setFormData((f) => ({ ...f, email: e.target.value }))
                  }
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Description / Notes
              </label>
              <Textarea
                placeholder="What do they need? How did they find you?"
                value={formData.description}
                onChange={(e) =>
                  setFormData((f) => ({ ...f, description: e.target.value }))
                }
                className="min-h-[80px] resize-none"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Stage
              </label>
              <div className="flex flex-wrap gap-2">
                {STATUS_ORDER.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setFormData((f) => ({ ...f, status: s }))}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      formData.status === s
                        ? STATUS_COLORS[s] + " border-current"
                        : "border-border/50 text-muted-foreground hover:border-border"
                    }`}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button variant="outline" onClick={closeModal} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={handleSaveLead} disabled={saving} className="gap-2">
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              {editLead ? "Save Changes" : "Add Lead"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── Proposal Modal ──────────────────────────────────────────────────── */}
      <Dialog
        open={!!proposalLead}
        onOpenChange={(open) => {
          if (!open) {
            setProposalLead(null);
            setProposalText("");
          }
        }}
      >
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              AI Proposal — {proposalLead?.business}
            </DialogTitle>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col gap-3 py-2">
            {generatingProposal ? (
              <div className="flex flex-col items-center justify-center flex-1 gap-3 text-muted-foreground">
                <Loader2 className="w-6 h-6 animate-spin" />
                <p className="text-sm">Generating proposal…</p>
              </div>
            ) : proposalText ? (
              <>
                <Textarea
                  value={proposalText}
                  onChange={(e) => setProposalText(e.target.value)}
                  className="flex-1 min-h-[320px] font-mono text-xs resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5"
                    onClick={copyProposal}
                  >
                    <Copy className="w-3.5 h-3.5" />
                    Copy to Clipboard
                  </Button>
                  {proposalLead && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5"
                      onClick={() => handleGenerateProposal(proposalLead)}
                    >
                      <FileText className="w-3.5 h-3.5" />
                      Regenerate
                    </Button>
                  )}
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center flex-1 text-muted-foreground text-sm">
                No proposal generated yet.
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

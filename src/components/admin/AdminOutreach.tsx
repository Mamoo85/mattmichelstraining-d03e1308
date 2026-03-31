import { memo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Plus, Sparkles, Copy, Check, Loader2, Trash2, Building2, MapPin, ChevronRight,
} from "lucide-react";
import { toast } from "sonner";

type KanbanStatus = "lead_found" | "ai_audited" | "contacted" | "negotiating" | "won";

interface Lead {
  id: string;
  business_name: string;
  owner_name: string | null;
  city: string | null;
  industry: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

const COLUMNS: { key: KanbanStatus; label: string; color: string }[] = [
  { key: "lead_found",  label: "Lead Found",   color: "bg-slate-500/20 text-slate-300 border-slate-500/30" },
  { key: "ai_audited",  label: "AI Audited",   color: "bg-blue-500/20 text-blue-300 border-blue-500/30" },
  { key: "contacted",   label: "Contacted",    color: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30" },
  { key: "negotiating", label: "Negotiating",  color: "bg-purple-500/20 text-purple-300 border-purple-500/30" },
  { key: "won",         label: "Won",          color: "bg-green-500/20 text-green-300 border-green-500/30" },
];

const ISSUES = [
  "No Google Business Profile",
  "Slow website (3s+ load time)",
  "Not mobile-friendly",
  "Outdated website design",
  "Missing or few reviews",
  "No clear call-to-action",
  "No social media presence",
  "No online booking / contact form",
];

const INDUSTRIES = [
  "Roofing", "HVAC", "Plumbing", "Electrical", "Landscaping",
  "Auto Repair", "Restaurant", "Salon / Barbershop", "Medical / Dental",
  "Real Estate", "Gym / Fitness", "Pest Control", "Retail", "Other",
];

const BLANK_FORM = {
  business_name: "", owner_name: "", city: "", industry: "",
  phone: "", email: "", website: "", notes: "",
};

const AdminOutreach = memo(() => {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [form, setForm] = useState({ ...BLANK_FORM });
  const [pitchLead, setPitchLead] = useState<Lead | null>(null);
  const [checkedIssues, setCheckedIssues] = useState<string[]>([]);
  const [pitchEmail, setPitchEmail] = useState("");
  const [pitchLoading, setPitchLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const { data: leads = [], isLoading } = useQuery<Lead[]>({
    queryKey: ["outreach-leads-kanban"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outreach_leads")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Lead[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (vals: typeof BLANK_FORM) => {
      const { error } = await supabase.from("outreach_leads").insert({
        ...vals,
        status: "lead_found",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outreach-leads-kanban"] });
      setAddOpen(false);
      setForm({ ...BLANK_FORM });
      toast.success("Lead added");
    },
    onError: () => toast.error("Failed to add lead"),
  });

  const moveMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: KanbanStatus }) => {
      const { error } = await supabase.from("outreach_leads").update({ status }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["outreach-leads-kanban"] }),
    onError: () => toast.error("Move failed"),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("outreach_leads").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outreach-leads-kanban"] });
      toast.success("Lead removed");
    },
    onError: () => toast.error("Delete failed"),
  });

  const handleGeneratePitch = async () => {
    if (!pitchLead) return;
    setPitchLoading(true);
    setPitchEmail("");
    try {
      const { data, error } = await supabase.functions.invoke("generate-audit-pitch", {
        body: {
          businessName: pitchLead.business_name,
          ownerName: pitchLead.owner_name,
          city: pitchLead.city,
          industry: pitchLead.industry,
          website: pitchLead.website,
          issues: checkedIssues,
        },
      });
      if (error) throw error;
      setPitchEmail((data as { email: string }).email);
    } catch (err) {
      toast.error("Generation failed. Check Supabase logs.");
      console.error(err);
    } finally {
      setPitchLoading(false);
    }
  };

  const handleMarkAudited = () => {
    if (!pitchLead) return;
    moveMutation.mutate({ id: pitchLead.id, status: "ai_audited" });
    setPitchLead(null);
    setPitchEmail("");
    setCheckedIssues([]);
    toast.success("Moved to AI Audited");
  };

  const leadsForColumn = (col: KanbanStatus) =>
    leads.filter((l) => {
      if (col === "lead_found") return !COLUMNS.slice(1).map((c) => c.key).includes(l.status as KanbanStatus);
      return l.status === col;
    });

  const won = leadsForColumn("won").length;
  const total = leads.length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#e8621a]/10 flex items-center justify-center">
            <Building2 size={18} className="text-[#e8621a]" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">Outreach CRM</h2>
            <p className="text-sm text-slate-400">{total} leads &middot; {won} won</p>
          </div>
        </div>
        <Button
          onClick={() => setAddOpen(true)}
          className="bg-[#e8621a] hover:bg-[#d4551a] text-white font-semibold"
          size="sm"
        >
          <Plus size={15} className="mr-1.5" /> Add Lead
        </Button>
      </div>

      {/* Kanban Board */}
      {isLoading ? (
        <div className="grid grid-cols-5 gap-3">
          {COLUMNS.map((col) => (
            <div key={col.key} className="bg-slate-900 rounded-xl border border-slate-700 p-3 space-y-2 animate-pulse">
              <div className="h-4 bg-slate-700 rounded w-3/4" />
              {[0, 1].map((i) => <div key={i} className="h-16 bg-slate-800 rounded-lg" />)}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-start">
          {COLUMNS.map((col) => {
            const colLeads = leadsForColumn(col.key);
            return (
              <div key={col.key} className="bg-slate-900 rounded-xl border border-slate-700 flex flex-col">
                <div className="flex items-center justify-between px-3 py-2.5 border-b border-slate-700">
                  <span className="text-xs font-semibold text-slate-300">{col.label}</span>
                  <span className="text-xs font-bold text-slate-500">{colLeads.length}</span>
                </div>
                <div className="p-2 space-y-2 min-h-[120px]">
                  {colLeads.length === 0 && (
                    <p className="text-xs text-slate-600 text-center py-6">Empty</p>
                  )}
                  {colLeads.map((lead) => (
                    <Card key={lead.id} className="bg-slate-800 border-slate-700 hover:border-[#e8621a]/40 transition-colors">
                      <CardContent className="p-3 space-y-1.5">
                        <p className="text-sm font-semibold text-white leading-tight">{lead.business_name}</p>
                        {lead.industry && (
                          <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${col.color}`}>
                            {lead.industry}
                          </Badge>
                        )}
                        {lead.city && (
                          <p className="text-xs text-slate-500 flex items-center gap-1">
                            <MapPin size={10} /> {lead.city}
                          </p>
                        )}
                        <div className="flex items-center gap-1 pt-1">
                          <button
                            onClick={() => {
                              setPitchLead(lead);
                              setCheckedIssues([]);
                              setPitchEmail("");
                            }}
                            className="flex items-center gap-1 text-[10px] text-[#e8621a] hover:text-[#ff8c4a] font-semibold"
                          >
                            <Sparkles size={10} /> Audit Pitch
                          </button>
                          <span className="text-slate-700 text-xs">|</span>
                          {/* Move dropdown */}
                          <Select
                            value={lead.status}
                            onValueChange={(val) => moveMutation.mutate({ id: lead.id, status: val as KanbanStatus })}
                          >
                            <SelectTrigger className="h-5 text-[10px] bg-transparent border-0 text-slate-500 hover:text-white p-0 w-auto gap-0.5 focus:ring-0">
                              <ChevronRight size={10} />
                              <span>Move</span>
                            </SelectTrigger>
                            <SelectContent className="bg-slate-800 border-slate-700">
                              {COLUMNS.map((c) => (
                                <SelectItem key={c.key} value={c.key} className="text-xs text-slate-300 hover:bg-slate-700">
                                  {c.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <span className="text-slate-700 text-xs">|</span>
                          <button
                            onClick={() => deleteMutation.mutate(lead.id)}
                            className="text-slate-600 hover:text-red-400 transition-colors"
                          >
                            <Trash2 size={10} />
                          </button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Lead Sheet */}
      <Sheet open={addOpen} onOpenChange={setAddOpen}>
        <SheetContent className="bg-slate-900 border-slate-700 text-white w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-white">Add New Lead</SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-4">
            {([
              { key: "business_name", label: "Business Name *", placeholder: "Smith Roofing LLC" },
              { key: "owner_name",    label: "Owner Name",       placeholder: "John Smith" },
              { key: "city",          label: "City",             placeholder: "Warren, MI" },
              { key: "phone",         label: "Phone",            placeholder: "(313) 555-1234" },
              { key: "email",         label: "Email",            placeholder: "john@smithroofing.com" },
              { key: "website",       label: "Website",          placeholder: "https://smithroofing.com" },
              { key: "notes",         label: "Notes",            placeholder: "Met at chamber event..." },
            ] as { key: keyof typeof BLANK_FORM; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
              <div key={key} className="space-y-1.5">
                <Label className="text-slate-300 text-sm">{label}</Label>
                <Input
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  placeholder={placeholder}
                  className="bg-slate-800 border-slate-600 text-white placeholder:text-slate-500"
                />
              </div>
            ))}
            <div className="space-y-1.5">
              <Label className="text-slate-300 text-sm">Industry</Label>
              <Select value={form.industry} onValueChange={(v) => setForm((f) => ({ ...f, industry: v }))}>
                <SelectTrigger className="bg-slate-800 border-slate-600 text-white">
                  <SelectValue placeholder="Select industry..." />
                </SelectTrigger>
                <SelectContent className="bg-slate-800 border-slate-700">
                  {INDUSTRIES.map((ind) => (
                    <SelectItem key={ind} value={ind} className="text-white hover:bg-slate-700">{ind}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              onClick={() => addMutation.mutate(form)}
              disabled={!form.business_name || addMutation.isPending}
              className="w-full bg-[#e8621a] hover:bg-[#d4551a] text-white font-semibold mt-2"
            >
              {addMutation.isPending ? <Loader2 size={16} className="animate-spin mr-2" /> : null}
              Add Lead
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Audit Pitch Modal */}
      <Dialog open={!!pitchLead} onOpenChange={(open) => { if (!open) { setPitchLead(null); setPitchEmail(""); setCheckedIssues([]); } }}>
        <DialogContent className="bg-slate-900 border-slate-700 text-white max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Sparkles size={16} className="text-[#e8621a]" />
              Generate Audit Pitch
            </DialogTitle>
          </DialogHeader>
          {pitchLead && (
            <div className="space-y-4 mt-2">
              <div className="bg-slate-800 rounded-lg px-4 py-3 text-sm">
                <p className="font-semibold text-white">{pitchLead.business_name}</p>
                <p className="text-slate-400 text-xs mt-0.5">
                  {[pitchLead.industry, pitchLead.city].filter(Boolean).join(" \u00b7 ")}
                  {pitchLead.website && <> &middot; <span className="text-[#e8621a]">{pitchLead.website}</span></>}
                </p>
              </div>

              <div>
                <p className="text-sm font-semibold text-slate-300 mb-2">Issues found (check all that apply):</p>
                <div className="space-y-2">
                  {ISSUES.map((issue) => (
                    <label key={issue} className="flex items-center gap-2.5 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={checkedIssues.includes(issue)}
                        onChange={(e) => setCheckedIssues((prev) =>
                          e.target.checked ? [...prev, issue] : prev.filter((i) => i !== issue)
                        )}
                        className="accent-[#e8621a] w-4 h-4"
                      />
                      <span className="text-sm text-slate-300 group-hover:text-white transition-colors">{issue}</span>
                    </label>
                  ))}
                </div>
              </div>

              <Button
                onClick={handleGeneratePitch}
                disabled={pitchLoading || checkedIssues.length === 0}
                className="w-full bg-[#e8621a] hover:bg-[#d4551a] text-white font-semibold"
              >
                {pitchLoading ? <Loader2 size={16} className="animate-spin mr-2" /> : <Sparkles size={16} className="mr-2" />}
                {pitchLoading ? "Generating..." : "Generate Cold Email"}
              </Button>

              {pitchEmail && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Generated Email</p>
                    <button
                      onClick={() => { navigator.clipboard.writeText(pitchEmail); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
                      className="flex items-center gap-1 text-xs text-slate-400 hover:text-white transition-colors"
                    >
                      {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                      {copied ? "Copied" : "Copy"}
                    </button>
                  </div>
                  <div className="bg-slate-800 rounded-lg p-4 border border-slate-700">
                    <pre className="whitespace-pre-wrap text-sm text-slate-300 font-sans leading-relaxed">{pitchEmail}</pre>
                  </div>
                  <Button
                    onClick={handleMarkAudited}
                    variant="outline"
                    className="w-full border-slate-600 text-slate-300 hover:bg-slate-800 hover:text-white"
                    size="sm"
                  >
                    Mark as AI Audited &rarr; Move to next column
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
});

AdminOutreach.displayName = "AdminOutreach";
export default AdminOutreach;

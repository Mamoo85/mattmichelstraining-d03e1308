import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AdminHelpCard } from "./AdminHelpCard";
import { getAdminGuide } from "@/lib/admin-guides";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Search, Mail, Zap, Users, TrendingUp, Play, RefreshCw, Loader2,
  Pencil, Send, Trash2, Filter, ArrowUpDown, ArrowDown, ArrowUp,
  Building2, Wrench, Stethoscope, Globe, Phone, MapPin, Star,
  Expand, Minimize, Megaphone, Rss, MessageSquare, Receipt, CalendarX,
  Hammer, Home, UserPlus, Plus, CheckCircle, ExternalLink, GripVertical,
  Crosshair, BarChart3, Kanban
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragOverEvent,
  DragOverlay,
  DragStartEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// ── INDUSTRIES for DataForSEO search ──
const SEARCH_INDUSTRIES = [
  "HVAC", "Plumbing", "Electrical", "Roofing", "Landscaping",
  "Medical Spa", "Dental Clinic", "Law Firm", "Industrial Automation",
  "Auto Repair", "Cleaning Service", "Painting", "Handyman",
  "Pest Control", "Garage Door", "Fencing", "Flooring",
  "Window Cleaning", "Pressure Washing", "Tree Service",
  "Pool Service", "Locksmith", "Towing", "Moving Company",
  "Home Inspector", "Interior Design", "Carpet Cleaning",
  "Appliance Repair", "Glass Repair", "Siding Contractor",
  "Concrete / Masonry", "Demolition", "Excavation",
  "Septic Service", "Well Drilling", "Solar Installation",
  "Insulation", "Fire Protection", "Elevator Service",
  "Machine Shop", "Metal Fabrication", "CNC Machining",
  "Tool & Die", "Injection Molding", "Sheet Metal",
  "Welding Shop", "Powder Coating", "Anodizing / Plating",
  "Restaurant", "Salon / Barbershop", "Fitness Studio",
  "Chiropractic", "Veterinary Clinic", "Optometry",
  "Physical Therapy", "Pharmacy", "Real Estate Agent",
  "Insurance Agency", "Accounting / CPA", "Financial Advisor",
];

// ── Pipeline Stages ──
const PIPELINE_STAGES = [
  { key: "new_lead", label: "New Lead", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  { key: "website_audited", label: "Website Audited", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { key: "outreach_sent", label: "Outreach Sent", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { key: "call_booked", label: "Call Booked", color: "bg-green-500/20 text-green-400 border-green-500/30" },
];

// ── Pipeline Lead Interface ──
interface PipelineLead {
  id: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  google_rating: number | null;
  review_count: number | null;
  gbp_claimed: boolean | null;
  google_place_id: string | null;
  pipeline_stage: string;
  pain_points: string[] | null;
  n8n_sent_at: string | null;
  source: string | null;
  created_at: string | null;
}

// ── DataForSEO Result ──
interface MapResult {
  title: string;
  rating: number | null;
  reviews: number | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  category: string | null;
  place_id: string | null;
  claimed: boolean | null;
}

// ── Shared Lead Interface (All Leads tab) ──
interface UnifiedLead {
  id: string;
  source_table: string;
  business_name: string;
  contact_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  industry: string | null;
  website: string | null;
  status: string | null;
  lead_score: number | null;
  notes: string | null;
  created_at: string | null;
  raw: Record<string, any>;
}

type SortField = "lead_score" | "email" | "created_at" | "business_name";
type SortDir = "asc" | "desc";

// ── Normalize functions per table ──
function normalizeOutreach(r: any): UnifiedLead {
  return { id: r.id, source_table: "outreach_leads", business_name: r.business_name, contact_name: r.owner_name, email: r.email, phone: r.phone, city: r.city, state: null, industry: r.industry, website: r.website, status: r.status, lead_score: r.lead_score, notes: r.notes, created_at: r.created_at, raw: r };
}
function normalizeContractorLead(r: any): UnifiedLead {
  return { id: r.id, source_table: "contractor_leads", business_name: r.name, contact_name: r.name, email: r.email, phone: r.phone, city: null, state: null, industry: r.project_type, website: null, status: r.status, lead_score: null, notes: r.message, created_at: r.created_at, raw: r };
}
function normalizeB2B(r: any): UnifiedLead {
  return { id: r.id, source_table: "b2b_clients", business_name: r.business_name, contact_name: r.owner_name, email: r.email, phone: r.phone, city: r.city, state: r.state, industry: r.industry, website: r.website, status: r.source || "cataloged", lead_score: null, notes: r.notes, created_at: r.created_at, raw: r };
}
function normalizeWebDesign(r: any): UnifiedLead {
  return { id: r.id, source_table: "web_design_leads", business_name: r.business || r.name || "Unknown", contact_name: r.name, email: r.email, phone: null, city: null, state: null, industry: "web design", website: r.site_url, status: r.status, lead_score: null, notes: r.notes || r.description, created_at: r.created_at, raw: r };
}
function normalizeSocialMedia(r: any): UnifiedLead {
  return { id: r.id, source_table: "social_media_clients", business_name: r.business_name, contact_name: r.contact_name, email: r.email, phone: r.phone, city: null, state: null, industry: r.industry, website: null, status: r.active ? "active" : "inactive", lead_score: null, notes: null, created_at: r.created_at, raw: r };
}
function normalizeGBP(r: any): UnifiedLead {
  return { id: r.id, source_table: "gbp_saas_clients", business_name: r.business_name, contact_name: r.contact_name, email: r.email, phone: r.phone, city: null, state: null, industry: r.industry, website: null, status: r.active ? "active" : "inactive", lead_score: null, notes: null, created_at: r.created_at, raw: r };
}
function normalizeNewsletter(r: any): UnifiedLead {
  return { id: r.id, source_table: "newsletter_subscribers", business_name: r.name || r.email, contact_name: r.name, email: r.email, phone: null, city: null, state: null, industry: r.niche, website: null, status: r.status || "subscribed", lead_score: null, notes: null, created_at: r.created_at, raw: r };
}
function normalizeEstimateDrip(r: any): UnifiedLead {
  return { id: r.id, source_table: "estimate_drip_clients", business_name: r.business_name, contact_name: r.contact_name, email: r.email, phone: r.phone, city: null, state: null, industry: r.industry, website: null, status: r.active ? "active" : "inactive", lead_score: null, notes: null, created_at: r.created_at, raw: r };
}
function normalizeNoshow(r: any): UnifiedLead {
  return { id: r.id, source_table: "noshow_clients", business_name: r.business_name, contact_name: r.contact_name, email: r.email, phone: r.phone, city: null, state: null, industry: r.industry, website: null, status: r.active ? "active" : "inactive", lead_score: null, notes: null, created_at: r.created_at, raw: r };
}
function normalizeInvoiceChaser(r: any): UnifiedLead {
  return { id: r.id, source_table: "invoice_chaser_clients", business_name: r.business_name, contact_name: r.contact_name, email: r.email, phone: r.phone, city: null, state: null, industry: r.industry, website: null, status: r.active ? "active" : "inactive", lead_score: null, notes: null, created_at: r.created_at, raw: r };
}
function normalizeReviewMonitor(r: any): UnifiedLead {
  return { id: r.id, source_table: "review_monitor_clients", business_name: r.business_name, contact_name: r.contact_name, email: r.email, phone: r.phone, city: null, state: null, industry: r.industry, website: null, status: r.active ? "active" : "inactive", lead_score: null, notes: null, created_at: r.created_at, raw: r };
}
function normalizeHomeowner(r: any): UnifiedLead {
  return { id: r.id, source_table: "homeowner_campaign_clients", business_name: r.business_name, contact_name: r.contact_name, email: r.email, phone: r.phone, city: null, state: null, industry: r.industry, website: null, status: r.active ? "active" : "inactive", lead_score: null, notes: null, created_at: r.created_at, raw: r };
}
function normalizeReferral(r: any): UnifiedLead {
  return { id: r.id, source_table: "referral_program_clients", business_name: r.business_name, contact_name: r.contact_name, email: r.email, phone: r.phone, city: null, state: null, industry: r.industry, website: null, status: r.active ? "active" : "inactive", lead_score: null, notes: null, created_at: r.created_at, raw: r };
}
function normalizeDripConversion(r: any): UnifiedLead {
  return { id: r.id, source_table: "drip_conversions", business_name: r.business_name || r.email, contact_name: null, email: r.email, phone: null, city: null, state: null, industry: r.industry, website: null, status: "converted", lead_score: null, notes: r.service_interested, created_at: r.converted_at, raw: r };
}

// ── Kanban Lead Card (Sortable) ──
function KanbanCard({ lead, onAudit, onSendN8n, onMoveStage, auditing, sending }: {
  lead: PipelineLead;
  onAudit: (lead: PipelineLead) => void;
  onSendN8n: (lead: PipelineLead) => void;
  onMoveStage: (lead: PipelineLead, stage: string) => void;
  auditing: boolean;
  sending: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: lead.id,
    data: { type: "card", lead },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="bg-card border border-border/40 rounded-lg p-3 space-y-2 hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-2">
        <div {...attributes} {...listeners} className="cursor-grab mt-0.5 text-muted-foreground hover:text-foreground">
          <GripVertical size={12} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{lead.business_name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {lead.google_rating && (
              <span className="text-[10px] flex items-center gap-0.5 text-yellow-400">
                <Star size={9} className="fill-yellow-400" /> {lead.google_rating}
              </span>
            )}
            {lead.review_count != null && (
              <span className="text-[10px] text-muted-foreground">({lead.review_count} reviews)</span>
            )}
            {lead.city && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <MapPin size={8} /> {lead.city}
              </span>
            )}
          </div>
          {lead.industry && <span className="text-[9px] text-muted-foreground">{lead.industry}</span>}
        </div>
      </div>

      {/* Pain points */}
      {lead.pain_points && lead.pain_points.length > 0 && (
        <div className="space-y-1 border-t border-border/30 pt-2">
          {lead.pain_points.map((p, i) => (
            <p key={i} className="text-[9px] text-amber-400/90 leading-tight">⚠ {p}</p>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 pt-1 border-t border-border/30">
        {lead.pipeline_stage === "new_lead" && (
          <Button variant="outline" size="sm" className="h-6 text-[9px] px-2 gap-1" disabled={auditing} onClick={() => onAudit(lead)}>
            {auditing ? <Loader2 size={10} className="animate-spin" /> : <Crosshair size={10} />}
            Audit
          </Button>
        )}
        {(lead.pipeline_stage === "website_audited" || lead.pain_points?.length) && !lead.n8n_sent_at && (
          <Button variant="outline" size="sm" className="h-6 text-[9px] px-2 gap-1" disabled={sending} onClick={() => onSendN8n(lead)}>
            {sending ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
            n8n
          </Button>
        )}
        {lead.pipeline_stage !== "call_booked" && (
          <Button variant="ghost" size="sm" className="h-6 text-[9px] px-2 gap-1 text-green-400" onClick={() => onMoveStage(lead, "call_booked")}>
            <CheckCircle size={10} /> Booked
          </Button>
        )}
        {lead.website && (
          <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" className="ml-auto">
            <ExternalLink size={10} className="text-muted-foreground hover:text-foreground" />
          </a>
        )}
      </div>
      {lead.n8n_sent_at && <Badge className="text-[8px] bg-green-500/20 text-green-400 border-0">n8n sent</Badge>}
    </div>
  );
}

// ── Kanban Column ──
function KanbanColumn({ stage, leads, onAudit, onSendN8n, onMoveStage, auditingId, sendingId }: {
  stage: typeof PIPELINE_STAGES[0];
  leads: PipelineLead[];
  onAudit: (lead: PipelineLead) => void;
  onSendN8n: (lead: PipelineLead) => void;
  onMoveStage: (lead: PipelineLead, stage: string) => void;
  auditingId: string | null;
  sendingId: string | null;
}) {
  return (
    <div className="flex-1 min-w-[220px] max-w-[300px]">
      <div className="flex items-center gap-2 mb-2">
        <Badge className={`text-[10px] ${stage.color}`}>{stage.label}</Badge>
        <Badge variant="outline" className="text-[9px] h-4">{leads.length}</Badge>
      </div>
      <div className="space-y-2 min-h-[200px] bg-muted/10 rounded-lg p-2 border border-dashed border-border/30">
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.map(lead => (
            <KanbanCard
              key={lead.id}
              lead={lead}
              onAudit={onAudit}
              onSendN8n={onSendN8n}
              onMoveStage={onMoveStage}
              auditing={auditingId === lead.id}
              sending={sendingId === lead.id}
            />
          ))}
        </SortableContext>
        {leads.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-8">Drop leads here</p>
        )}
      </div>
    </div>
  );
}

// ── Component ──
export default function AdminProspector() {
  const [mainTab, setMainTab] = useState<"search" | "pipeline" | "leads">("search");

  // ── Search Tab State ──
  const [searchIndustry, setSearchIndustry] = useState("");
  const [searchLocation, setSearchLocation] = useState("Grosse Pointe, MI");
  const [searchLimit, setSearchLimit] = useState("10");
  const [searching, setSearching] = useState(false);
  const [mapResults, setMapResults] = useState<MapResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());

  // ── Pipeline Tab State ──
  const [pipelineLeads, setPipelineLeads] = useState<PipelineLead[]>([]);
  const [loadingPipeline, setLoadingPipeline] = useState(false);
  const [auditingId, setAuditingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  // ── All Leads Tab State ──
  const [activeLeadTab, setActiveLeadTab] = useState("all");
  const [leads, setLeads] = useState<UnifiedLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterIndustry, setFilterIndustry] = useState("all");
  const [filterArea, setFilterArea] = useState("all");
  const [filterHasEmail, setFilterHasEmail] = useState("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [editingLead, setEditingLead] = useState<UnifiedLead | null>(null);
  const [leadSendingId, setLeadSendingId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Legacy prospecting
  const [query, setQuery] = useState("");
  const [location, setLocation] = useState("Grosse Pointe, MI");
  const [running, setRunning] = useState(false);
  const [dripRunning, setDripRunning] = useState(false);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // ── DataForSEO Maps Search ──
  const runMapsSearch = async () => {
    if (!searchIndustry) { toast.error("Select an industry"); return; }
    setSearching(true);
    setMapResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("dataforseo-maps-search", {
        body: { industry: searchIndustry, location: searchLocation, limit: parseInt(searchLimit) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMapResults(data?.results || []);
      toast.success(`Found ${data?.results?.length || 0} businesses`);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Search failed"); }
    finally { setSearching(false); }
  };

  // ── Add to Pipeline ──
  const addToPipeline = async (results: MapResult[]) => {
    try {
      for (const r of results) {
        const { error } = await (supabase as any).from("prospect_pipeline").insert({
          business_name: r.title,
          phone: r.phone,
          website: r.website,
          city: searchLocation.split(",")[0]?.trim() || null,
          state: searchLocation.split(",")[1]?.trim() || null,
          industry: searchIndustry,
          google_rating: r.rating,
          review_count: r.reviews,
          gbp_claimed: r.claimed,
          google_place_id: r.place_id,
          pipeline_stage: "new_lead",
          source: "dataforseo",
        });
        if (error) console.error("Insert error:", error);
      }
      toast.success(`Added ${results.length} leads to pipeline`);
      setSelectedResults(new Set());
      fetchPipeline();
    } catch (err) { toast.error("Failed to add to pipeline"); }
  };

  // ── Pipeline CRUD ──
  const fetchPipeline = useCallback(async () => {
    setLoadingPipeline(true);
    try {
      const { data } = await (supabase as any).from("prospect_pipeline").select("*").order("created_at", { ascending: false });
      setPipelineLeads((data || []).map((d: any) => ({
        ...d,
        pain_points: d.pain_points ? (Array.isArray(d.pain_points) ? d.pain_points : []) : null,
      })));
    } catch { toast.error("Failed to load pipeline"); }
    finally { setLoadingPipeline(false); }
  }, []);

  const updatePipelineStage = async (leadId: string, stage: string) => {
    const { error } = await (supabase as any).from("prospect_pipeline").update({ pipeline_stage: stage, updated_at: new Date().toISOString() }).eq("id", leadId);
    if (error) { toast.error("Failed to update stage"); return; }
    setPipelineLeads(prev => prev.map(l => l.id === leadId ? { ...l, pipeline_stage: stage } : l));
  };

  // ── Website Audit ──
  const auditWebsite = async (lead: PipelineLead) => {
    if (!lead.website) { toast.error("No website to audit"); return; }
    setAuditingId(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke("prospect-website-audit", {
        body: { url: lead.website, business_name: lead.business_name, industry: lead.industry },
      });
      if (error) throw error;
      if (data?.pain_points) {
        await (supabase as any).from("prospect_pipeline").update({
          pain_points: data.pain_points,
          pipeline_stage: "website_audited",
          updated_at: new Date().toISOString(),
        }).eq("id", lead.id);
        setPipelineLeads(prev => prev.map(l => l.id === lead.id ? { ...l, pain_points: data.pain_points, pipeline_stage: "website_audited" } : l));
        toast.success("Audit complete — 3 pain points found");
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Audit failed"); }
    finally { setAuditingId(null); }
  };

  // ── Send to n8n ──
  const sendToN8n = async (lead: PipelineLead) => {
    setSendingId(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke("send-lead-to-n8n", {
        body: { lead, pain_points: lead.pain_points || [] },
      });
      if (error) throw error;
      await (supabase as any).from("prospect_pipeline").update({
        n8n_sent_at: new Date().toISOString(),
        pipeline_stage: "outreach_sent",
        updated_at: new Date().toISOString(),
      }).eq("id", lead.id);
      setPipelineLeads(prev => prev.map(l => l.id === lead.id ? { ...l, n8n_sent_at: new Date().toISOString(), pipeline_stage: "outreach_sent" } : l));
      toast.success("Lead sent to n8n ✓");
    } catch (err) { toast.error(err instanceof Error ? err.message : "n8n send failed"); }
    finally { setSendingId(null); }
  };

  // ── Drag & Drop ──
  const handleDragStart = (event: DragStartEvent) => setActiveDragId(event.active.id as string);

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;
    const overId = over.id as string;
    const activeId = active.id as string;
    // Check if dropped on a column
    const targetStage = PIPELINE_STAGES.find(s => s.key === overId);
    if (targetStage) {
      updatePipelineStage(activeId, targetStage.key);
      return;
    }
    // Check if dropped on another card — find that card's stage
    const targetLead = pipelineLeads.find(l => l.id === overId);
    if (targetLead) {
      updatePipelineStage(activeId, targetLead.pipeline_stage);
    }
  };

  // ── All Leads Data ──
  const fetchTable = async (table: string, normalizer: (r: any) => UnifiedLead) => {
    const { data } = await (supabase as any).from(table).select("*").order("created_at", { ascending: false }).limit(500);
    return (data || []).map(normalizer);
  };

  const SOURCE_MAP: Record<string, { table: string; fn: (r: any) => UnifiedLead }> = {
    prospects: { table: "outreach_leads", fn: normalizeOutreach },
    contractor: { table: "contractor_leads", fn: normalizeContractorLead },
    dental: { table: "b2b_clients", fn: normalizeB2B },
    webdesign: { table: "web_design_leads", fn: normalizeWebDesign },
    social: { table: "social_media_clients", fn: normalizeSocialMedia },
    gbp: { table: "gbp_saas_clients", fn: normalizeGBP },
    newsletter: { table: "newsletter_subscribers", fn: normalizeNewsletter },
    estimate: { table: "estimate_drip_clients", fn: normalizeEstimateDrip },
    noshow: { table: "noshow_clients", fn: normalizeNoshow },
    invoice: { table: "invoice_chaser_clients", fn: normalizeInvoiceChaser },
    reviews: { table: "review_monitor_clients", fn: normalizeReviewMonitor },
    homeowner: { table: "homeowner_campaign_clients", fn: normalizeHomeowner },
    referral: { table: "referral_program_clients", fn: normalizeReferral },
    conversions: { table: "drip_conversions", fn: normalizeDripConversion },
  };

  const fetchLeads = async () => {
    setLoadingLeads(true);
    try {
      let results: UnifiedLead[] = [];
      if (activeLeadTab === "all") {
        const promises = Object.values(SOURCE_MAP).map(s => fetchTable(s.table, s.fn));
        const arrays = await Promise.all(promises);
        results = arrays.flat();
      } else if (SOURCE_MAP[activeLeadTab]) {
        results = await fetchTable(SOURCE_MAP[activeLeadTab].table, SOURCE_MAP[activeLeadTab].fn);
      }
      setLeads(results);
    } catch { toast.error("Failed to load leads"); }
    finally { setLoadingLeads(false); }
  };

  useEffect(() => { if (mainTab === "leads") fetchLeads(); }, [activeLeadTab, mainTab]);
  useEffect(() => { if (mainTab === "pipeline") fetchPipeline(); }, [mainTab, fetchPipeline]);

  // ── Filtering + Sorting ──
  const uniqueIndustries = useMemo(() => [...new Set(leads.map(l => l.industry).filter(Boolean))].sort(), [leads]);
  const uniqueAreas = useMemo(() => {
    const areas = leads.map(l => [l.city, l.state].filter(Boolean).join(", ")).filter(Boolean);
    return [...new Set(areas)].sort();
  }, [leads]);

  const filtered = useMemo(() => {
    let result = leads;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => l.business_name.toLowerCase().includes(q) || (l.contact_name || "").toLowerCase().includes(q) || (l.email || "").toLowerCase().includes(q) || (l.phone || "").includes(q));
    }
    if (filterStatus !== "all") result = result.filter(l => (l.status || "").toLowerCase() === filterStatus.toLowerCase());
    if (filterIndustry !== "all") result = result.filter(l => l.industry === filterIndustry);
    if (filterArea !== "all") result = result.filter(l => [l.city, l.state].filter(Boolean).join(", ") === filterArea);
    if (filterHasEmail === "yes") result = result.filter(l => !!l.email);
    if (filterHasEmail === "no") result = result.filter(l => !l.email);
    result.sort((a, b) => {
      let aVal: any, bVal: any;
      if (sortField === "lead_score") { aVal = a.lead_score ?? -1; bVal = b.lead_score ?? -1; }
      else if (sortField === "email") { aVal = a.email ? 0 : 1; bVal = b.email ? 0 : 1; }
      else if (sortField === "business_name") { aVal = a.business_name.toLowerCase(); bVal = b.business_name.toLowerCase(); }
      else { aVal = a.created_at || ""; bVal = b.created_at || ""; }
      if (aVal < bVal) return sortDir === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDir === "asc" ? 1 : -1;
      return 0;
    });
    return result;
  }, [leads, searchQuery, filterStatus, filterIndustry, filterArea, filterHasEmail, sortField, sortDir]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortField(field); setSortDir("desc"); }
  };

  // ── Legacy Actions ──
  const runProspecting = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("prospect-local-businesses", { body: { query: query || undefined, location, radius: 10, limit: 10 } });
      if (error) throw error;
      toast.success(`Prospecting complete: ${data?.queued || 0} leads added`);
      fetchLeads();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Prospecting failed"); }
    finally { setRunning(false); }
  };

  const runDrip = async () => {
    setDripRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("web-design-drip", { body: {} });
      if (error) throw error;
      toast.success(`Drip complete: ${data?.sent || 0} emails sent`);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Drip failed"); }
    finally { setDripRunning(false); }
  };

  const sendOneEmail = async (lead: UnifiedLead) => {
    if (!lead.email) return;
    setLeadSendingId(lead.id);
    try {
      const { error } = await supabase.functions.invoke("web-design-drip", { body: { leadId: lead.id } });
      if (error) throw error;
      toast.success(`Email sent to ${lead.business_name}`);
      fetchLeads();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Send failed"); }
    finally { setLeadSendingId(null); }
  };

  const updateLead = async (lead: UnifiedLead) => {
    try {
      if (lead.source_table === "outreach_leads") {
        await supabase.from("outreach_leads").update({ business_name: lead.business_name, email: lead.email, phone: lead.phone, industry: lead.industry, city: lead.city, notes: lead.notes, status: lead.status } as any).eq("id", lead.id);
      } else if (lead.source_table === "b2b_clients") {
        await supabase.from("b2b_clients").update({ business_name: lead.business_name, email: lead.email!, phone: lead.phone, industry: lead.industry, city: lead.city, state: lead.state, notes: lead.notes } as any).eq("id", lead.id);
      } else if (lead.source_table === "web_design_leads") {
        await supabase.from("web_design_leads").update({ business: lead.business_name, email: lead.email, notes: lead.notes, status: lead.status || "new" } as any).eq("id", lead.id);
      }
      toast.success("Lead updated");
      setEditingLead(null);
      fetchLeads();
    } catch { toast.error("Update failed"); }
  };

  const deleteLead = async (lead: UnifiedLead) => {
    try {
      const { error } = await (supabase as any).from(lead.source_table).delete().eq("id", lead.id);
      if (error) throw error;
      toast.success("Lead deleted");
      fetchLeads();
    } catch { toast.error("Delete failed"); }
  };

  const leadsWithEmail = filtered.filter(l => l.email);
  const sourceLabel: Record<string, string> = {
    outreach_leads: "Prospect", contractor_leads: "Contractor", b2b_clients: "B2B/Dental",
    web_design_leads: "Web Design", social_media_clients: "Social", gbp_saas_clients: "GBP",
    newsletter_subscribers: "Newsletter", estimate_drip_clients: "Estimate", noshow_clients: "No-Show",
    invoice_chaser_clients: "Invoice", review_monitor_clients: "Reviews", homeowner_campaign_clients: "Homeowner",
    referral_program_clients: "Referral", drip_conversions: "Converted",
  };
  const sourceBadgeColor: Record<string, string> = {
    outreach_leads: "bg-primary/20 text-primary", contractor_leads: "bg-orange-500/20 text-orange-400",
    b2b_clients: "bg-blue-500/20 text-blue-400", web_design_leads: "bg-purple-500/20 text-purple-400",
    social_media_clients: "bg-pink-500/20 text-pink-400", gbp_saas_clients: "bg-emerald-500/20 text-emerald-400",
    newsletter_subscribers: "bg-yellow-500/20 text-yellow-400", estimate_drip_clients: "bg-cyan-500/20 text-cyan-400",
    noshow_clients: "bg-red-500/20 text-red-400", invoice_chaser_clients: "bg-amber-500/20 text-amber-400",
    review_monitor_clients: "bg-indigo-500/20 text-indigo-400", homeowner_campaign_clients: "bg-lime-500/20 text-lime-400",
    referral_program_clients: "bg-teal-500/20 text-teal-400", drip_conversions: "bg-green-500/20 text-green-400",
  };

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-0.5" onClick={() => toggleSort(field)}>
      {label}
      {sortField === field ? (sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-40" />}
    </Button>
  );

  const guide = getAdminGuide("prospector");

  const pipelineByStage = useMemo(() => {
    const map: Record<string, PipelineLead[]> = {};
    PIPELINE_STAGES.forEach(s => { map[s.key] = []; });
    pipelineLeads.forEach(l => {
      if (map[l.pipeline_stage]) map[l.pipeline_stage].push(l);
      else map["new_lead"].push(l);
    });
    return map;
  }, [pipelineLeads]);

  return (
    <div className="space-y-4">
      {guide && <AdminHelpCard id={guide.id} title={guide.title} body={guide.body} tips={guide.tips} scenarios={guide.scenarios} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Lead Generation & Pipeline Manager</h2>
          <p className="text-xs text-muted-foreground">Search, audit, outreach & track leads across all sources</p>
        </div>
        <Badge variant="outline" className="text-xs">Unified CRM</Badge>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 border-b border-border/40 pb-1">
        {[
          { key: "search" as const, label: "Search", icon: Search },
          { key: "pipeline" as const, label: "Pipeline", icon: Kanban },
          { key: "leads" as const, label: "All Leads", icon: Users },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setMainTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-semibold transition-colors ${
              mainTab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            <t.icon size={12} />
            {t.label}
            {t.key === "pipeline" && pipelineLeads.length > 0 && (
              <Badge variant="secondary" className="text-[9px] h-4 px-1 ml-0.5">{pipelineLeads.length}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* ═══════════ SEARCH TAB ═══════════ */}
      {mainTab === "search" && (
        <div className="space-y-4">
          <Card className="border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Search size={14} className="text-primary" /> Google Maps Lead Extraction
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid sm:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">Industry</Label>
                  <Select value={searchIndustry} onValueChange={setSearchIndustry}>
                    <SelectTrigger className="text-xs h-8 mt-1"><SelectValue placeholder="Select industry..." /></SelectTrigger>
                    <SelectContent className="max-h-[300px]">
                      {SEARCH_INDUSTRIES.map(i => <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">City / Zip Code</Label>
                  <Input value={searchLocation} onChange={e => setSearchLocation(e.target.value)} placeholder="Grosse Pointe, MI or 48236" className="text-xs h-8 mt-1" />
                </div>
                <div>
                  <Label className="text-xs">Max Results</Label>
                  <Select value={searchLimit} onValueChange={setSearchLimit}>
                    <SelectTrigger className="text-xs h-8 mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["5", "10", "20", "50"].map(n => <SelectItem key={n} value={n} className="text-xs">{n}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={runMapsSearch} disabled={searching} className="text-xs" size="sm">
                  {searching ? <><Loader2 size={12} className="animate-spin mr-1.5" /> Searching...</> : <><Search size={12} className="mr-1.5" /> Search Google Maps</>}
                </Button>
                {mapResults.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs gap-1"
                    onClick={() => {
                      if (selectedResults.size > 0) {
                        addToPipeline(mapResults.filter((_, i) => selectedResults.has(i)));
                      } else {
                        addToPipeline(mapResults);
                      }
                    }}
                  >
                    <Plus size={12} />
                    {selectedResults.size > 0 ? `Add ${selectedResults.size} Selected` : `Add All ${mapResults.length}`} to Pipeline
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Results Table */}
          {mapResults.length > 0 && (
            <Card className="border-border/40">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <BarChart3 size={14} className="text-primary" /> Search Results
                  <Badge variant="secondary" className="text-[10px]">{mapResults.length} found</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/40 text-muted-foreground">
                        <th className="text-left py-2 pr-2 w-8">
                          <input
                            type="checkbox"
                            checked={selectedResults.size === mapResults.length && mapResults.length > 0}
                            onChange={e => {
                              if (e.target.checked) setSelectedResults(new Set(mapResults.map((_, i) => i)));
                              else setSelectedResults(new Set());
                            }}
                            className="rounded"
                          />
                        </th>
                        <th className="text-left py-2">Business</th>
                        <th className="text-left py-2">Rating</th>
                        <th className="text-left py-2">Reviews</th>
                        <th className="text-left py-2">Phone</th>
                        <th className="text-left py-2">Website</th>
                        <th className="text-left py-2">Claimed</th>
                      </tr>
                    </thead>
                    <tbody>
                      {mapResults.map((r, i) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-muted/20">
                          <td className="py-2 pr-2">
                            <input
                              type="checkbox"
                              checked={selectedResults.has(i)}
                              onChange={e => {
                                const next = new Set(selectedResults);
                                if (e.target.checked) next.add(i); else next.delete(i);
                                setSelectedResults(next);
                              }}
                              className="rounded"
                            />
                          </td>
                          <td className="py-2 font-medium">{r.title}</td>
                          <td className="py-2">
                            {r.rating ? (
                              <span className="flex items-center gap-0.5 text-yellow-400">
                                <Star size={10} className="fill-yellow-400" /> {r.rating}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="py-2 text-muted-foreground">{r.reviews ?? "—"}</td>
                          <td className="py-2 text-muted-foreground">{r.phone || "—"}</td>
                          <td className="py-2">
                            {r.website ? (
                              <a href={r.website.startsWith("http") ? r.website : `https://${r.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline flex items-center gap-0.5">
                                <ExternalLink size={9} /> Site
                              </a>
                            ) : <span className="text-destructive/60">None</span>}
                          </td>
                          <td className="py-2">
                            {r.claimed ? <Badge className="text-[8px] bg-green-500/20 text-green-400 border-0">Yes</Badge> : <Badge variant="outline" className="text-[8px]">No</Badge>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Legacy Prospecting + Drip */}
          <div className="grid sm:grid-cols-2 gap-4">
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap size={14} className="text-primary" /> Legacy Prospector (Firecrawl)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="e.g. plumber, dentist..." className="text-xs h-8" />
                <Input value={location} onChange={e => setLocation(e.target.value)} placeholder="City, ST" className="text-xs h-8" />
                <Button onClick={runProspecting} disabled={running} className="w-full text-xs" size="sm">
                  {running ? <><Loader2 size={12} className="animate-spin mr-1.5" /> Prospecting...</> : <><Play size={12} className="mr-1.5" /> Run</>}
                </Button>
              </CardContent>
            </Card>
            <Card className="border-border/40">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Mail size={14} className="text-primary" /> Drip Email Sequence
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1 text-[10px] text-muted-foreground">
                  {["Day 1: Competitors getting calls you're not", "Day 4: Quick follow-up + demo", "Day 8: Quick online presence check", "Day 15: Last message from me"].map(s => (
                    <p key={s} className="p-1 bg-muted/30 rounded">• {s}</p>
                  ))}
                </div>
                <Button onClick={runDrip} disabled={dripRunning} variant="outline" className="w-full text-xs" size="sm">
                  {dripRunning ? <><Loader2 size={12} className="animate-spin mr-1.5" /> Processing...</> : <><RefreshCw size={12} className="mr-1.5" /> Process Drip</>}
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ═══════════ PIPELINE TAB (Kanban) ═══════════ */}
      {mainTab === "pipeline" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Drag leads between columns to update their stage</p>
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={fetchPipeline} disabled={loadingPipeline}>
              <RefreshCw size={10} className={loadingPipeline ? "animate-spin" : ""} /> Refresh
            </Button>
          </div>

          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="flex gap-3 overflow-x-auto pb-4">
              {PIPELINE_STAGES.map(stage => (
                <SortableContext key={stage.key} id={stage.key} items={pipelineByStage[stage.key]?.map(l => l.id) || []} strategy={verticalListSortingStrategy}>
                  <KanbanColumn
                    stage={stage}
                    leads={pipelineByStage[stage.key] || []}
                    onAudit={auditWebsite}
                    onSendN8n={sendToN8n}
                    onMoveStage={(lead, s) => updatePipelineStage(lead.id, s)}
                    auditingId={auditingId}
                    sendingId={sendingId}
                  />
                </SortableContext>
              ))}
            </div>
          </DndContext>

          {pipelineLeads.length === 0 && !loadingPipeline && (
            <Card className="border-border/40 border-dashed">
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No leads in pipeline yet. Use the <strong>Search</strong> tab to find businesses and add them.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════ ALL LEADS TAB ═══════════ */}
      {mainTab === "leads" && (
        <Card className="border-border/40">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm flex items-center gap-2">
                <Users size={14} className="text-primary" /> Lead Catalog
                <Badge variant="secondary" className="text-[10px] ml-1">{filtered.length} results</Badge>
                <Badge className="text-[10px] ml-1 bg-green-500/20 text-green-400">{leadsWithEmail.length} with email</Badge>
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => setIsExpanded(!isExpanded)}>
                  {isExpanded ? <Minimize size={10} /> : <Expand size={10} />}
                </Button>
                <Button variant="ghost" size="sm" onClick={fetchLeads} className="text-xs h-7">
                  <RefreshCw size={10} className={loadingLeads ? "animate-spin mr-1" : "mr-1"} /> Refresh
                </Button>
              </div>
            </div>

            {/* Sub-tabs */}
            <div className="mt-2 overflow-x-auto scrollbar-hide">
              <div className="flex gap-1 pb-1 min-w-max">
                {[
                  { key: "all", label: "All", icon: Globe },
                  { key: "prospects", label: "Prospects", icon: TrendingUp },
                  { key: "contractor", label: "Contractor", icon: Wrench },
                  { key: "dental", label: "B2B", icon: Stethoscope },
                  { key: "webdesign", label: "Web Design", icon: Building2 },
                  { key: "social", label: "Social", icon: Megaphone },
                  { key: "gbp", label: "GBP", icon: MapPin },
                  { key: "newsletter", label: "Newsletter", icon: Rss },
                  { key: "estimate", label: "Estimate", icon: Receipt },
                  { key: "noshow", label: "No-Show", icon: CalendarX },
                  { key: "invoice", label: "Invoice", icon: Receipt },
                  { key: "reviews", label: "Reviews", icon: Star },
                  { key: "homeowner", label: "Homeowner", icon: Home },
                  { key: "referral", label: "Referral", icon: UserPlus },
                  { key: "conversions", label: "Converted", icon: TrendingUp },
                ].map(tab => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.key}
                      onClick={() => setActiveLeadTab(tab.key)}
                      className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold whitespace-nowrap transition-colors ${
                        activeLeadTab === tab.key ? "bg-primary text-primary-foreground" : "bg-muted/40 text-muted-foreground hover:bg-muted/60"
                      }`}
                    >
                      <Icon size={10} />
                      {tab.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Filters */}
            <div className="space-y-2 mt-3">
              <div className="relative">
                <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input placeholder="Search name, email, phone..." className="text-xs h-8 pl-8" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="text-xs h-7 w-28"><Filter size={10} className="mr-1" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["all", "new", "emailed", "responded", "closed", "cataloged"].map(s => (
                      <SelectItem key={s} value={s} className="text-xs">{s === "all" ? "All Status" : s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterHasEmail} onValueChange={setFilterHasEmail}>
                  <SelectTrigger className="text-xs h-7 w-28"><Mail size={10} className="mr-1" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Emails</SelectItem>
                    <SelectItem value="yes" className="text-xs">Has Email</SelectItem>
                    <SelectItem value="no" className="text-xs">No Email</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <span className="mr-1">Sort:</span>
                <SortButton field="lead_score" label="Score" />
                <SortButton field="email" label="Email" />
                <SortButton field="created_at" label="Date" />
                <SortButton field="business_name" label="Name" />
              </div>
            </div>
          </CardHeader>

          <CardContent>
            <div className={`${isExpanded ? "max-h-none" : "max-h-[500px]"} overflow-y-auto space-y-1`}>
              {filtered.length === 0 && !loadingLeads && (
                <p className="text-xs text-muted-foreground text-center py-8">No leads found.</p>
              )}
              {loadingLeads && <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>}
              {filtered.map(lead => (
                <div key={`${lead.source_table}-${lead.id}`} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors group">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-semibold truncate">{lead.business_name}</span>
                      {activeLeadTab === "all" && (
                        <Badge className={`text-[8px] px-1 h-3.5 border-0 ${sourceBadgeColor[lead.source_table] || ""}`}>
                          {sourceLabel[lead.source_table]}
                        </Badge>
                      )}
                      {lead.status && <Badge variant={lead.status.toLowerCase() === "emailed" ? "default" : "secondary"} className="text-[9px] px-1.5 h-4">{lead.status}</Badge>}
                      {lead.lead_score != null && (
                        <span className="text-[9px] flex items-center gap-0.5">
                          <Star size={9} className={lead.lead_score >= 70 ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground"} />
                          {lead.lead_score}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                      {lead.email ? <span className="text-[10px] text-primary/80 truncate">{lead.email}</span> : <span className="text-[10px] text-destructive/60 italic">no email</span>}
                      {(lead.city || lead.state) && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><MapPin size={8} /> {[lead.city, lead.state].filter(Boolean).join(", ")}</span>}
                      {lead.phone && <span className="text-[10px] text-muted-foreground flex items-center gap-0.5"><Phone size={8} /> {lead.phone}</span>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingLead({ ...lead })}><Pencil size={12} /></Button>
                      </DialogTrigger>
                      <DialogContent className="max-w-md">
                        <DialogHeader><DialogTitle className="text-sm">Edit Lead</DialogTitle></DialogHeader>
                        {editingLead && editingLead.id === lead.id && (
                          <div className="space-y-3">
                            <div><Label className="text-xs">Business Name</Label><Input className="text-xs h-8 mt-1" value={editingLead.business_name} onChange={e => setEditingLead({ ...editingLead, business_name: e.target.value })} /></div>
                            <div><Label className="text-xs">Email</Label><Input className="text-xs h-8 mt-1" value={editingLead.email || ""} onChange={e => setEditingLead({ ...editingLead, email: e.target.value })} /></div>
                            <div className="grid grid-cols-2 gap-2">
                              <div><Label className="text-xs">Phone</Label><Input className="text-xs h-8 mt-1" value={editingLead.phone || ""} onChange={e => setEditingLead({ ...editingLead, phone: e.target.value })} /></div>
                              <div><Label className="text-xs">Industry</Label><Input className="text-xs h-8 mt-1" value={editingLead.industry || ""} onChange={e => setEditingLead({ ...editingLead, industry: e.target.value })} /></div>
                            </div>
                            <div><Label className="text-xs">Notes</Label><Textarea className="text-xs mt-1" rows={3} value={editingLead.notes || ""} onChange={e => setEditingLead({ ...editingLead, notes: e.target.value })} /></div>
                            <Button onClick={() => updateLead(editingLead)} className="w-full text-xs" size="sm">Save Changes</Button>
                          </div>
                        )}
                      </DialogContent>
                    </Dialog>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary" disabled={!lead.email || leadSendingId === lead.id} onClick={() => sendOneEmail(lead)}>
                      {leadSendingId === lead.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                    </Button>
                    <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (confirm(`Delete ${lead.business_name}?`)) deleteLead(lead); }}>
                      <Trash2 size={12} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

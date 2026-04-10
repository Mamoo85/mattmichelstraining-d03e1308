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
import { Switch } from "@/components/ui/switch";
import {
  Search, Mail, Zap, Users, TrendingUp, Play, RefreshCw, Loader2,
  Pencil, Send, Trash2, Filter, ArrowUpDown, ArrowDown, ArrowUp,
  Building2, Wrench, Stethoscope, Globe, Phone, MapPin, Star,
  Expand, Minimize, Megaphone, Rss, MessageSquare, Receipt, CalendarX,
  Hammer, Home, UserPlus, Plus, CheckCircle, ExternalLink, GripVertical,
  Crosshair, BarChart3, Kanban, FileText, Eye, EyeOff, Info, X, ShieldCheck
} from "lucide-react";
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
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
  { key: "website_audited", label: "Audited", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
  { key: "outreach_sent", label: "Outreach", color: "bg-purple-500/20 text-purple-400 border-purple-500/30" },
  { key: "call_booked", label: "Booked", color: "bg-green-500/20 text-green-400 border-green-500/30" },
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
  deep_research: { summary: string; citations: string[]; researched_at: string } | null;
  n8n_sent_at: string | null;
  source: string | null;
  created_at: string | null;
  gap_analysis: string | null;
  drip_step: number;
  drip_status: string;
  last_drip_at: string | null;
  drip_subject: string | null;
  drip_body: string | null;
  has_facebook: boolean;
  has_instagram: boolean;
  lead_score: number | null;
  breach_count: number | null;
  notes: string | null;
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

// ── Hybrid Result ──
interface HybridResult extends MapResult {
  gap_analysis: string | null;
  core_service: string | null;
  specific_site_flaw: string | null;
  recent_activity: string | null;
  gap_status: "pending" | "analyzing" | "done" | "skipped" | "error";
  email: string | null;
  email_status: "found" | "not_found" | "skipped" | "error";
}

// ── Shared Lead Interface ──
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

// Pipeline filter/sort types
type PipelineFilter = "all" | "has_email" | "no_email" | "has_website" | "no_website" | "has_reviews" | "no_facebook" | "no_instagram";
type PipelineSort = "reviews_desc" | "rating_desc" | "name_asc" | "newest" | "drip_status" | "score_desc";

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

// ── Drip Status Badge ──
const DRIP_LABELS: Record<number, string> = {
  1: "Day 1 Sent",
  2: "Day 4 Sent",
  3: "Day 8 Sent",
  4: "Day 15 Sent",
};
function DripBadge({ step, status }: { step: number; status: string }) {
  if (status === "completed") return <Badge className="text-[8px] bg-green-500/20 text-green-400 border-0">Drip Done ✓</Badge>;
  if (status === "active" && step > 0) return (
    <Badge className="text-[8px] bg-purple-500/20 text-purple-400 border-0">
      {DRIP_LABELS[step] || `Step ${step}/4`}
    </Badge>
  );
  if (status === "queued") return <Badge className="text-[8px] bg-blue-500/20 text-blue-400 border-0">Queued</Badge>;
  if (status === "drafted") return <Badge className="text-[8px] bg-amber-500/20 text-amber-400 border-0">Draft Ready</Badge>;
  return null;
}

// ── Kanban Lead Card ──
function KanbanCard({ lead, onAudit, onSendN8n, onMoveStage, onDeepResearch, onDrip, onPreviewDrip, onDelete, auditing, sending, researching, dripping }: {
  lead: PipelineLead;
  onAudit: (lead: PipelineLead) => void;
  onSendN8n: (lead: PipelineLead) => void;
  onMoveStage: (lead: PipelineLead, stage: string) => void;
  onDeepResearch: (lead: PipelineLead) => void;
  onDrip: (lead: PipelineLead, action: "draft" | "send" | "send_existing") => void;
  onPreviewDrip: (lead: PipelineLead) => void;
  onDelete: (lead: PipelineLead) => void;
  auditing: boolean;
  sending: boolean;
  researching: boolean;
  dripping: boolean;
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
          <div className="flex items-center gap-1.5">
            <p className="text-xs font-semibold truncate">{lead.business_name}</p>
            {lead.lead_score != null && (
              <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                lead.lead_score >= 8 ? "bg-green-500/20 text-green-400" :
                lead.lead_score >= 5 ? "bg-amber-500/20 text-amber-400" :
                "bg-muted text-muted-foreground"
              }`}>
                {lead.lead_score}/10
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {lead.google_rating && (
              <span className="text-[10px] flex items-center gap-0.5 text-yellow-400">
                <Star size={9} className="fill-yellow-400" /> {lead.google_rating}
              </span>
            )}
            {lead.review_count != null && (
              <span className="text-[10px] text-muted-foreground">({lead.review_count})</span>
            )}
            {lead.city && (
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <MapPin size={8} /> {lead.city}
              </span>
            )}
          </div>
          {/* Contact info row */}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {lead.email ? (
              <span className="text-[9px] text-green-400 flex items-center gap-0.5">
                <Mail size={8} /> ✓
              </span>
            ) : (
              <span className="text-[9px] text-destructive/60 flex items-center gap-0.5">
                <Mail size={8} /> ✗
              </span>
            )}
            {lead.phone ? (
              <a href={`tel:${lead.phone}`} className="text-[9px] text-primary/80 flex items-center gap-0.5 hover:text-primary">
                <Phone size={8} /> {lead.phone}
              </a>
            ) : (
              <span className="text-[9px] text-destructive/60 flex items-center gap-0.5">
                <Phone size={8} /> ✗
              </span>
            )}
          </div>
          {/* Presence indicators */}
          <div className="flex items-center gap-1.5 mt-1">
            {lead.website ? (
              <Badge className="text-[7px] h-3.5 px-1 bg-green-500/20 text-green-400 border-0">Web ✓</Badge>
            ) : (
              <Badge className="text-[7px] h-3.5 px-1 bg-red-500/20 text-red-400 border-0">No Site</Badge>
            )}
            {!lead.has_facebook && <Badge className="text-[7px] h-3.5 px-1 bg-red-500/20 text-red-400 border-0">No FB</Badge>}
            {!lead.has_instagram && <Badge className="text-[7px] h-3.5 px-1 bg-red-500/20 text-red-400 border-0">No IG</Badge>}
          </div>
          {lead.industry && <span className="text-[9px] text-muted-foreground block mt-0.5">{lead.industry}</span>}
        </div>
      </div>

      {/* Drip status */}
      {(lead.drip_step > 0 || lead.drip_status !== "not_started") && (
        <div className="border-t border-border/30 pt-1.5">
          <DripBadge step={lead.drip_step} status={lead.drip_status} />
          {lead.last_drip_at && (
            <p className="text-[8px] text-muted-foreground mt-0.5">
              Last sent: {new Date(lead.last_drip_at).toLocaleDateString()}
            </p>
          )}
        </div>
      )}

      {/* Pain points */}
      {lead.pain_points && lead.pain_points.length > 0 && (
        <div className="space-y-1 border-t border-border/30 pt-2">
          {lead.pain_points.slice(0, 2).map((p, i) => (
            <p key={i} className="text-[9px] text-amber-400/90 leading-tight">⚠ {p}</p>
          ))}
        </div>
      )}

      {/* Gap analysis snippet */}
      {lead.gap_analysis && (
        <div className="border-t border-border/30 pt-1.5">
          <p className="text-[8px] text-cyan-400/80 leading-tight truncate">🔍 {lead.gap_analysis.slice(0, 80)}...</p>
        </div>
      )}

      {/* Deep Research results */}
      {lead.deep_research?.summary && (
        <div className="space-y-1 border-t border-border/30 pt-2">
          <p className="text-[9px] font-semibold text-cyan-400 flex items-center gap-1">
            <Globe size={9} /> Web Intel
          </p>
          <p className="text-[9px] text-foreground/80 leading-tight whitespace-pre-line">
            {lead.deep_research.summary.slice(0, 300)}
          </p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 pt-1 border-t border-border/30 flex-wrap">
        {lead.pipeline_stage === "new_lead" && lead.website && (
          <Button variant="outline" size="sm" className="h-6 text-[9px] px-2 gap-1" disabled={auditing} onClick={() => onAudit(lead)}>
            {auditing ? <Loader2 size={10} className="animate-spin" /> : <Crosshair size={10} />}
            Audit
          </Button>
        )}
        {!lead.deep_research && (
          <Button variant="outline" size="sm" className="h-6 text-[9px] px-2 gap-1 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10" disabled={researching} onClick={() => onDeepResearch(lead)}>
            {researching ? <Loader2 size={10} className="animate-spin" /> : <Globe size={10} />}
            Research
          </Button>
        )}
        {/* Drip actions — only if lead has email */}
        {lead.email && lead.drip_status !== "completed" && (
          <>
            {lead.drip_status === "drafted" ? (
              <>
                <Button variant="outline" size="sm" className="h-6 text-[9px] px-2 gap-1 text-amber-400 border-amber-500/30" onClick={() => onPreviewDrip(lead)}>
                  <Eye size={10} /> Preview
                </Button>
                <Button variant="outline" size="sm" className="h-6 text-[9px] px-2 gap-1 text-green-400 border-green-500/30" disabled={dripping} onClick={() => onDrip(lead, "send_existing")}>
                  {dripping ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                  Send
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" size="sm" className="h-6 text-[9px] px-2 gap-1 text-purple-400 border-purple-500/30" disabled={dripping} onClick={() => onDrip(lead, "draft")}>
                  {dripping ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />}
                  Draft
                </Button>
                <Button variant="outline" size="sm" className="h-6 text-[9px] px-2 gap-1 text-green-400 border-green-500/30" disabled={dripping} onClick={() => onDrip(lead, "send")}>
                  {dripping ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
                  Send
                </Button>
              </>
            )}
          </>
        )}
        {lead.pipeline_stage !== "call_booked" && (
          <Button variant="ghost" size="sm" className="h-6 text-[9px] px-2 gap-1 text-green-400" onClick={() => onMoveStage(lead, "call_booked")}>
            <CheckCircle size={10} /> Booked
          </Button>
        )}
        <div className="ml-auto flex items-center gap-1">
          {lead.website && (
            <a href={lead.website.startsWith("http") ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink size={10} className="text-muted-foreground hover:text-foreground" />
            </a>
          )}
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-destructive/50 hover:text-destructive hover:bg-destructive/10" onClick={() => { if (confirm(`Delete ${lead.business_name}?`)) onDelete(lead); }}>
            <Trash2 size={10} />
          </Button>
        </div>
      </div>
      {lead.n8n_sent_at && <Badge className="text-[8px] bg-green-500/20 text-green-400 border-0">n8n sent</Badge>}
      {/* Stale indicator: in outreach_sent with no activity for 7+ days */}
      {lead.pipeline_stage === "outreach_sent" && lead.last_drip_at && (() => {
        const days = Math.floor((Date.now() - new Date(lead.last_drip_at).getTime()) / 86400000);
        return days >= 7 ? (
          <Badge className="text-[7px] bg-amber-500/15 text-amber-400 border border-amber-500/20">
            ⚠ {days}d no reply
          </Badge>
        ) : null;
      })()}
    </div>
  );
}

// ── Kanban Column ──
function KanbanColumn({ stage, leads, onAudit, onSendN8n, onMoveStage, onDeepResearch, onDrip, onPreviewDrip, onDelete, auditingId, sendingId, researchingId, drippingId }: {
  stage: typeof PIPELINE_STAGES[0];
  leads: PipelineLead[];
  onAudit: (lead: PipelineLead) => void;
  onSendN8n: (lead: PipelineLead) => void;
  onMoveStage: (lead: PipelineLead, stage: string) => void;
  onDeepResearch: (lead: PipelineLead) => void;
  onDrip: (lead: PipelineLead, action: "draft" | "send" | "send_existing") => void;
  onPreviewDrip: (lead: PipelineLead) => void;
  onDelete: (lead: PipelineLead) => void;
  auditingId: string | null;
  sendingId: string | null;
  researchingId: string | null;
  drippingId: string | null;
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
              onDeepResearch={onDeepResearch}
              onDrip={onDrip}
              onPreviewDrip={onPreviewDrip}
              onDelete={onDelete}
              auditing={auditingId === lead.id}
              sending={sendingId === lead.id}
              researching={researchingId === lead.id}
              dripping={drippingId === lead.id}
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
  const [mainTab, setMainTab] = useState<"search" | "pipeline" | "sent" | "leads">("search");

  // ── Search Tab State ──
  const [searchIndustry, setSearchIndustry] = useState("");
  const [searchLocation, setSearchLocation] = useState("Grosse Pointe, MI");
  const [searchLimit, setSearchLimit] = useState("10");
  const [searching, setSearching] = useState(false);
  const [mapResults, setMapResults] = useState<MapResult[]>([]);
  const [selectedResults, setSelectedResults] = useState<Set<number>>(new Set());
  const [strictEmailFilter, setStrictEmailFilter] = useState(false);
  const [allowEmailGuess, setAllowEmailGuess] = useState(true);
  const [scanMode, setScanMode] = useState<"quick" | "deep">("deep");
  const [showHowItWorks, setShowHowItWorks] = useState(() => {
    try { return localStorage.getItem("omni-how-it-works-dismissed") !== "true"; } catch { return true; }
  });

  // ── Omni Engine State ──
  const [omniSearching, setOmniSearching] = useState(false);
  const [omniResults, setOmniResults] = useState<any>(null);

  // ── Hybrid Search State ──
  const [hybridSearching, setHybridSearching] = useState(false);
  const [hybridResults, setHybridResults] = useState<HybridResult[]>([]);

  // ── Pipeline Tab State ──
  const [pipelineLeads, setPipelineLeads] = useState<PipelineLead[]>([]);
  const [loadingPipeline, setLoadingPipeline] = useState(false);
  const [auditingId, setAuditingId] = useState<string | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [researchingId, setResearchingId] = useState<string | null>(null);
  const [reEnrichingId, setReEnrichingId] = useState<string | null>(null);
  const [drippingId, setDrippingId] = useState<string | null>(null);
  const [pipelineFilter, setPipelineFilter] = useState<PipelineFilter>("all");
  const [pipelineSort, setPipelineSort] = useState<PipelineSort>("newest");
  const [previewLead, setPreviewLead] = useState<PipelineLead | null>(null);
  const [selectedPipelineIds, setSelectedPipelineIds] = useState<Set<string>>(new Set());
  const [batchProcessing, setBatchProcessing] = useState(false);

  // ── Sent Log State ──
  const [sentEmails, setSentEmails] = useState<any[]>([]);
  const [loadingSent, setLoadingSent] = useState(false);
  const [archiving, setArchiving] = useState(false);

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

  // ── Hybrid Prospector Search ──
  const runHybridSearch = async () => {
    if (!searchIndustry) { toast.error("Select an industry"); return; }
    setHybridSearching(true);
    setHybridResults([]);
    try {
      const { data, error } = await supabase.functions.invoke("hybrid-prospector", {
        body: { industry: searchIndustry, location: searchLocation, limit: parseInt(searchLimit) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setHybridResults(data?.results || []);
      toast.success(`Found ${data?.total || 0} businesses with gap analysis`);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Hybrid search failed"); }
    finally { setHybridSearching(false); }
  };

  // ── Add to Pipeline ──
  const addToPipeline = async (results: (MapResult | HybridResult)[]) => {
    try {
      let added = 0;
      for (const r of results) {
        const isHybrid = "gap_analysis" in r;
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
          source: isHybrid ? "hybrid" : "dataforseo",
          gap_analysis: isHybrid ? (r as HybridResult).gap_analysis : null,
          core_service: isHybrid ? (r as HybridResult).core_service : null,
          specific_site_flaw: isHybrid ? (r as HybridResult).specific_site_flaw : null,
          recent_activity: isHybrid ? (r as HybridResult).recent_activity : null,
          email: isHybrid ? (r as HybridResult).email : null,
        });
        if (error) {
          console.error("Insert error:", error);
        } else {
          added++;
        }
      }
      toast.success(`Added ${added} leads to pipeline`);
      setSelectedResults(new Set());
      fetchPipeline();
    } catch (err) { toast.error("Failed to add to pipeline"); }
  };

  // ── Pipeline CRUD ──
  const fetchPipeline = useCallback(async () => {
    setLoadingPipeline(true);
    try {
      const { data, error } = await (supabase as any).from("prospect_pipeline").select("*").order("created_at", { ascending: false });
      if (error) {
        console.error("Pipeline fetch error:", error);
        toast.error("Failed to load pipeline: " + error.message);
        return;
      }
      setPipelineLeads((data || []).map((d: any) => ({
        ...d,
        pain_points: d.pain_points ? (Array.isArray(d.pain_points) ? d.pain_points : []) : null,
        drip_step: d.drip_step || 0,
        drip_status: d.drip_status || "not_started",
        has_facebook: d.has_facebook ?? false,
        has_instagram: d.has_instagram ?? false,
      })));
    } catch { toast.error("Failed to load pipeline"); }
    finally { setLoadingPipeline(false); }
  }, []);

  const logActivity = async (leadId: string, type: string, content?: string, metadata?: Record<string, any>) => {
    try {
      await (supabase as any).from("lead_activities").insert({
        lead_id: leadId, lead_table: "prospect_pipeline", type, content: content || null, metadata: metadata || {},
      });
      await (supabase as any).from("prospect_pipeline").update({ last_activity_at: new Date().toISOString() }).eq("id", leadId);
    } catch { /* non-blocking */ }
  };

  const updatePipelineStage = async (leadId: string, stage: string) => {
    const { error } = await (supabase as any).from("prospect_pipeline").update({ pipeline_stage: stage, updated_at: new Date().toISOString() }).eq("id", leadId);
    if (error) { toast.error("Failed to update stage"); return; }
    setPipelineLeads(prev => prev.map(l => l.id === leadId ? { ...l, pipeline_stage: stage } : l));
    const lead = pipelineLeads.find(l => l.id === leadId);
    logActivity(leadId, "stage_changed", `Moved to ${stage}`, { business_name: lead?.business_name });
  };

  const deletePipelineLead = async (lead: PipelineLead) => {
    const { error } = await (supabase as any).from("prospect_pipeline").delete().eq("id", lead.id);
    if (error) { toast.error("Failed to delete lead"); return; }
    setPipelineLeads(prev => prev.filter(l => l.id !== lead.id));
    toast.success(`Deleted ${lead.business_name}`);
  };

  const bulkDeletePipeline = async () => {
    if (selectedPipelineIds.size === 0) { toast.error("No leads selected"); return; }
    if (!confirm(`Delete ${selectedPipelineIds.size} leads permanently?`)) return;
    setBatchProcessing(true);
    try {
      const ids = Array.from(selectedPipelineIds);
      const { error } = await (supabase as any).from("prospect_pipeline").delete().in("id", ids);
      if (error) throw error;
      setPipelineLeads(prev => prev.filter(l => !selectedPipelineIds.has(l.id)));
      setSelectedPipelineIds(new Set());
      toast.success(`Deleted ${ids.length} leads`);
    } catch { toast.error("Bulk delete failed"); }
    finally { setBatchProcessing(false); }
  };

  const clearDuplicates = async () => {
    const seen = new Map<string, PipelineLead>();
    const dupeIds: string[] = [];
    for (const l of pipelineLeads) {
      const key = `${l.business_name.toLowerCase().trim()}|${(l.city || "").toLowerCase().trim()}`;
      if (seen.has(key)) {
        const existing = seen.get(key)!;
        const keepNew = (l.created_at || "") > (existing.created_at || "");
        dupeIds.push(keepNew ? existing.id : l.id);
        if (keepNew) seen.set(key, l);
      } else {
        seen.set(key, l);
      }
    }
    if (dupeIds.length === 0) { toast.info("No duplicates found"); return; }
    if (!confirm(`Found ${dupeIds.length} duplicate leads. Delete them?`)) return;
    setBatchProcessing(true);
    try {
      const { error } = await (supabase as any).from("prospect_pipeline").delete().in("id", dupeIds);
      if (error) throw error;
      const dupeSet = new Set(dupeIds);
      setPipelineLeads(prev => prev.filter(l => !dupeSet.has(l.id)));
      toast.success(`Removed ${dupeIds.length} duplicates`);
    } catch { toast.error("Dedupe failed"); }
    finally { setBatchProcessing(false); }
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
          deep_research: data.deep_research || null,
          gap_analysis: data.gap_analysis || data.pain_points?.join("; ") || null,
          pipeline_stage: "website_audited",
          updated_at: new Date().toISOString(),
        }).eq("id", lead.id);
        setPipelineLeads(prev => prev.map(l => l.id === lead.id ? {
          ...l,
          pain_points: data.pain_points,
          deep_research: data.deep_research || null,
          gap_analysis: data.gap_analysis || data.pain_points?.join("; ") || null,
          pipeline_stage: "website_audited",
        } : l));
        logActivity(lead.id, "audited", `Pain points: ${data.pain_points?.slice(0, 2).join("; ")}`, { business_name: lead.business_name });
        toast.success("Audit complete — pain points captured");
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Audit failed"); }
    finally { setAuditingId(null); }
  };

  // ── Deep Research ──
  const deepResearch = async (lead: PipelineLead) => {
    setResearchingId(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke("openrouter-research", {
        body: {
          query: `Search the web for recent news, services, reviews, and business developments for "${lead.business_name}" ${lead.industry ? `in the ${lead.industry} industry` : ""} ${lead.city ? `in ${lead.city}` : ""}. What are their current pain points, recent changes, or competitive weaknesses? Return 3 concise bullet points of factual, recent intel.`,
        },
      });
      if (error) throw error;
      if (data?.content) {
        const researchData = {
          summary: data.content,
          citations: data.citations || [],
          researched_at: new Date().toISOString(),
        };
        await (supabase as any).from("prospect_pipeline").update({
          deep_research: researchData,
          updated_at: new Date().toISOString(),
        }).eq("id", lead.id);
        setPipelineLeads(prev => prev.map(l => l.id === lead.id ? { ...l, deep_research: researchData } : l));
        toast.success("Deep research complete");
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Research failed"); }
    finally { setResearchingId(null); }
  };

  // ── Pipeline Drip ──
  const runPipelineDrip = async (lead: PipelineLead, action: "draft" | "send" | "send_existing") => {
    if (!lead.email) { toast.error("Lead has no email"); return; }
    setDrippingId(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke("pipeline-drip-send", {
        body: { leadId: lead.id, action },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }

      if (action === "draft") {
        toast.success("Draft generated — review before sending");
        setPipelineLeads(prev => prev.map(l => l.id === lead.id ? {
          ...l,
          drip_subject: data.subject,
          drip_body: data.body,
          drip_status: "drafted",
        } : l));
      } else {
        logActivity(lead.id, "email_sent", `Drip step ${data.step}/4: ${data.subject || ""}`, { business_name: lead.business_name });
        toast.success(`Email sent to ${lead.business_name} (Step ${data.step}/4)`);
        setPipelineLeads(prev => prev.map(l => l.id === lead.id ? {
          ...l,
          drip_step: data.step,
          drip_status: data.step >= 4 ? "completed" : "active",
          drip_subject: null,
          drip_body: null,
          last_drip_at: new Date().toISOString(),
          pipeline_stage: "outreach_sent",
        } : l));
      }
    } catch (err) { toast.error(err instanceof Error ? err.message : "Drip failed"); }
    finally { setDrippingId(null); }
  };

  // ── Batch Drip ──
  const runBatchDrip = async (action: "draft_all" | "send_all" | "send_drafted") => {
    const ids = selectedPipelineIds.size > 0
      ? Array.from(selectedPipelineIds)
      : filteredPipelineLeads.filter(l => !!l.email).map(l => l.id);
    if (ids.length === 0) { toast.error("No emailable leads selected"); return; }
    setBatchProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("pipeline-batch-drip", {
        body: { leadIds: ids, action },
      });
      if (error) throw error;
      if (data?.error) { toast.error(data.error); return; }
      const label = action === "draft_all" ? "drafted" : "sent";
      toast.success(`Batch complete: ${data.drafted || data.sent || 0} ${label}, ${data.errors || 0} errors`);
      setSelectedPipelineIds(new Set());
      fetchPipeline();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Batch failed"); }
    finally { setBatchProcessing(false); }
  };

  // ── Fetch Sent Emails ──
  const fetchSentEmails = useCallback(async () => {
    setLoadingSent(true);
    try {
      const { data, error } = await (supabase as any)
        .from("prospect_email_log")
        .select("*")
        .order("sent_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      setSentEmails(data || []);
    } catch { toast.error("Failed to load sent emails"); }
    finally { setLoadingSent(false); }
  }, []);

  // ── Archive Outreach-Sent Leads ──
  const archiveSentLeads = async () => {
    const sentLeads = pipelineLeads.filter(l => l.pipeline_stage === "outreach_sent");
    if (sentLeads.length === 0) { toast.info("No outreach-sent leads to archive"); return; }
    setArchiving(true);
    try {
      const ids = sentLeads.map(l => l.id);
      const { error } = await (supabase as any)
        .from("prospect_pipeline")
        .update({ pipeline_stage: "archived" })
        .in("id", ids);
      if (error) throw error;
      toast.success(`Archived ${ids.length} leads`);
      fetchPipeline();
    } catch { toast.error("Archive failed"); }
    finally { setArchiving(false); }
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
    const targetStage = PIPELINE_STAGES.find(s => s.key === overId);
    if (targetStage) {
      updatePipelineStage(activeId, targetStage.key);
      return;
    }
    const targetLead = pipelineLeads.find(l => l.id === overId);
    if (targetLead) {
      updatePipelineStage(activeId, targetLead.pipeline_stage);
    }
  };

  // ── Pipeline filtering & sorting ──
  const filteredPipelineLeads = useMemo(() => {
    let result = [...pipelineLeads];
    switch (pipelineFilter) {
      case "has_email": result = result.filter(l => !!l.email); break;
      case "no_email": result = result.filter(l => !l.email); break;
      case "has_website": result = result.filter(l => !!l.website); break;
      case "no_website": result = result.filter(l => !l.website); break;
      case "has_reviews": result = result.filter(l => (l.review_count || 0) > 0); break;
      case "no_facebook": result = result.filter(l => !l.has_facebook); break;
      case "no_instagram": result = result.filter(l => !l.has_instagram); break;
    }
    switch (pipelineSort) {
      case "score_desc": result.sort((a, b) => (b.lead_score || 0) - (a.lead_score || 0)); break;
      case "reviews_desc": result.sort((a, b) => (b.review_count || 0) - (a.review_count || 0)); break;
      case "rating_desc": result.sort((a, b) => (b.google_rating || 0) - (a.google_rating || 0)); break;
      case "name_asc": result.sort((a, b) => a.business_name.localeCompare(b.business_name)); break;
      case "drip_status": result.sort((a, b) => a.drip_step - b.drip_step); break;
      default: result.sort((a, b) => (b.created_at || "").localeCompare(a.created_at || "")); break;
    }
    return result;
  }, [pipelineLeads, pipelineFilter, pipelineSort]);

  const pipelineByStage = useMemo(() => {
    const map: Record<string, PipelineLead[]> = {};
    PIPELINE_STAGES.forEach(s => { map[s.key] = []; });
    filteredPipelineLeads.forEach(l => {
      if (map[l.pipeline_stage]) map[l.pipeline_stage].push(l);
      else map["new_lead"].push(l);
    });
    return map;
  }, [filteredPipelineLeads]);

  // Pipeline stats
  const pipelineStats = useMemo(() => ({
    total: pipelineLeads.length,
    withEmail: pipelineLeads.filter(l => !!l.email).length,
    withReviews: pipelineLeads.filter(l => (l.review_count || 0) > 0).length,
    noWebsite: pipelineLeads.filter(l => !l.website).length,
    dripping: pipelineLeads.filter(l => l.drip_status === "active").length,
    drafted: pipelineLeads.filter(l => l.drip_status === "drafted").length,
  }), [pipelineLeads]);

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
  useEffect(() => { if (mainTab === "sent") fetchSentEmails(); }, [mainTab, fetchSentEmails]);

  // ── Filtering + Sorting ──
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

  // ── Omni-Channel Lead Engine Search ──
  const runOmniSearch = async () => {
    if (!searchIndustry) { toast.error("Select an industry"); return; }
    if (omniSearching) return; // double-click guard
    setOmniSearching(true);
    setOmniResults(null);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 90_000);

    try {
      const { data, error } = await supabase.functions.invoke("omni-lead-engine", {
        body: {
          industry: searchIndustry,
          location: searchLocation,
          limit: parseInt(searchLimit),
          strict_email_filter: strictEmailFilter,
          allow_email_guess: allowEmailGuess,
          scan_mode: scanMode,
        },
      });
      clearTimeout(timeoutId);
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setOmniResults(data);
      const failMsg = data?.failed ? `, ${data.failed} failed` : "";
      toast.success(`Engine complete: ${data?.saved || 0} leads saved, ${data?.discarded || 0} discarded${failMsg}`);
      fetchPipeline();
    } catch (err: any) {
      clearTimeout(timeoutId);
      if (err?.name === "AbortError" || err?.message?.includes("abort")) {
        toast.error("Search timed out. Try a smaller batch.");
      } else {
        toast.error(err instanceof Error ? err.message : "Omni engine failed");
      }
    } finally {
      setOmniSearching(false);
    }
  };

  // ── Re-Enrich a pipeline lead (run waterfall again to find email) ──
  const reEnrichLead = async (lead: PipelineLead) => {
    if (!lead.website && !lead.google_place_id) { toast.error("No website to enrich from"); return; }
    setReEnrichingId(lead.id);
    try {
      let domain = "";
      if (lead.website) {
        try {
          const url = lead.website.startsWith("http") ? lead.website : `https://${lead.website}`;
          domain = new URL(url).hostname.replace(/^www\./, "");
        } catch { domain = ""; }
      }
      if (!domain) { toast.error("Could not extract domain from website"); return; }
      const { data, error } = await supabase.functions.invoke("lead-enrichment-waterfall", {
        body: { domain, business_name: lead.business_name, website: lead.website, allow_email_guess: true },
      });
      if (error) throw error;
      const newEmail = data?.email || null;
      const newName = data?.decision_maker_name || data?.contact_name || null;
      const source = data?.enrichment_source || "none";
      await (supabase as any).from("prospect_pipeline").update({
        ...(newEmail ? { email: newEmail } : {}),
        ...(newName && !lead.contact_name ? { contact_name: newName } : {}),
        notes: `Enrichment source: ${source}.`,
        updated_at: new Date().toISOString(),
      }).eq("id", lead.id);
      setPipelineLeads(prev => prev.map(l => l.id === lead.id ? {
        ...l,
        email: newEmail || l.email,
        contact_name: newName && !l.contact_name ? newName : l.contact_name,
        notes: `Enrichment source: ${source}.`,
      } : l));
      if (newEmail) toast.success(`Found email via ${source}: ${newEmail}`);
      else toast.info(`No email found (tried ${source}) — lead kept in pipeline`);
    } catch (err) { toast.error(err instanceof Error ? err.message : "Re-enrich failed"); }
    finally { setReEnrichingId(null); }
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

  return (
    <div className="space-y-4">
      {guide && <AdminHelpCard id={guide.id} title={guide.title} body={guide.body} tips={guide.tips} scenarios={guide.scenarios} />}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Omni-Channel Lead Engine</h2>
          <p className="text-xs text-muted-foreground">Maps → Scrape → Enrich → Pipeline</p>
        </div>
        <Badge variant="outline" className="text-xs">Unified CRM</Badge>
      </div>

      {/* Main Tabs */}
      <div className="flex gap-1 border-b border-border/40 pb-1">
        {[
          { key: "search" as const, label: "Search", icon: Search },
          { key: "pipeline" as const, label: "Pipeline", icon: Kanban },
          { key: "sent" as const, label: "Sent Log", icon: Mail },
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
          {/* How It Works Card */}
          {showHowItWorks && (
            <Card className="border-primary/30 bg-primary/5 relative">
              <button
                onClick={() => { setShowHowItWorks(false); try { localStorage.setItem("omni-how-it-works-dismissed", "true"); } catch {} }}
                className="absolute top-2 right-2 p-1 rounded-full hover:bg-muted/40 text-muted-foreground hover:text-foreground transition-colors"
              >
                <X size={14} />
              </button>
              <CardContent className="py-4">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                    <Info size={16} className="text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-bold mb-2">How the Omni-Channel Lead Engine Works</p>
                    <div className="grid sm:grid-cols-5 gap-2">
                      {[
                        { step: "1", label: "Enter industry & location" },
                        { step: "2", label: "We scan Maps for businesses" },
                        { step: "3", label: "We read their website via Firecrawl" },
                        { step: "4", label: "Our API waterfall hunts the decision-maker's email" },
                        { step: "5", label: "Only complete profiles are saved to your pipeline" },
                      ].map((s) => (
                        <div key={s.step} className="flex items-start gap-1.5 p-2 rounded-lg bg-background/50 border border-border/30">
                          <span className="w-5 h-5 rounded-full bg-primary/20 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">{s.step}</span>
                          <p className="text-[10px] text-muted-foreground leading-snug">{s.label}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="border-border/40">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Zap size={14} className="text-primary" /> Omni-Channel Lead Engine
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

              {/* Strict Email Filter Toggle */}
              <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 border border-border/30">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className={strictEmailFilter ? "text-green-400" : "text-muted-foreground"} />
                  <div>
                    <p className="text-xs font-semibold">Strict Email Filter</p>
                    <p className="text-[10px] text-muted-foreground">Only save leads with verified emails</p>
                  </div>
                </div>
                <Switch checked={strictEmailFilter} onCheckedChange={setStrictEmailFilter} />
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button onClick={runOmniSearch} disabled={omniSearching || searching || hybridSearching} className="text-xs gap-1.5" size="sm">
                  {omniSearching ? (
                    <><Loader2 size={12} className="animate-spin" /> Engine Running… Do Not Click Again</>
                  ) : (
                    <><Zap size={12} /> Search (Full Pipeline)</>
                  )}
                </Button>
                <Button onClick={runMapsSearch} disabled={searching || omniSearching || hybridSearching} variant="outline" className="text-xs" size="sm">
                  {searching ? <><Loader2 size={12} className="animate-spin mr-1.5" /> Searching...</> : <><Search size={12} className="mr-1.5" /> Quick Maps Only</>}
                </Button>
                {mapResults.length > 0 && (
                  <Button
                    variant="outline" size="sm" className="text-xs gap-1"
                    onClick={() => {
                      if (selectedResults.size > 0) addToPipeline(mapResults.filter((_, i) => selectedResults.has(i)));
                      else addToPipeline(mapResults);
                    }}
                  >
                    <Plus size={12} />
                    {selectedResults.size > 0 ? `Add ${selectedResults.size} Selected` : `Add All ${mapResults.length}`} to Pipeline
                  </Button>
                )}
              </div>
              {omniSearching && (
                <div className="flex items-center gap-2 p-2 rounded-md bg-primary/10 border border-primary/20">
                  <Loader2 size={14} className="animate-spin text-primary" />
                  <span className="text-[11px] text-primary font-medium">
                    Step 1: Google Maps → Step 2: Firecrawl Scrape → Step 3: Enrichment Waterfall → Step 4: Filter & Save
                  </span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Search Results */}
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
                          <input type="checkbox"
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
                            <input type="checkbox" checked={selectedResults.has(i)}
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
                          <td className="py-2">
                            {r.phone ? (
                              <a href={`tel:${r.phone}`} className="text-primary/80 hover:text-primary flex items-center gap-0.5">
                                <Phone size={9} /> {r.phone}
                              </a>
                            ) : <span className="text-muted-foreground">—</span>}
                          </td>
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

          {/* Hybrid Results */}
          {hybridResults.length > 0 && (
            <Card className="border-cyan-500/30 bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Zap size={14} className="text-cyan-400" />
                  <span className="text-cyan-400">Hybrid Results — Gap Analysis</span>
                  <Badge className="text-[10px] bg-cyan-500/20 text-cyan-400 border-cyan-500/30">{hybridResults.length} leads</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                     <thead>
                      <tr className="border-b border-cyan-500/20 text-muted-foreground">
                        <th className="text-left py-2 font-semibold">Business Name</th>
                        <th className="text-left py-2 font-semibold">Phone</th>
                        <th className="text-left py-2 font-semibold">Email</th>
                        <th className="text-left py-2 font-semibold">Core Service</th>
                        <th className="text-left py-2 font-semibold">Site Flaw</th>
                        <th className="text-left py-2 font-semibold">Gap Analysis</th>
                        <th className="text-left py-2 font-semibold w-16">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {hybridResults.map((r, i) => (
                        <tr key={i} className="border-b border-border/20 hover:bg-cyan-500/5 transition-colors">
                          <td className="py-2.5 font-medium pr-3">
                            <div className="flex items-center gap-1.5">
                              <Building2 size={11} className="text-muted-foreground shrink-0" />
                              <span>{r.title}</span>
                            </div>
                            {r.rating && (
                              <span className="text-[9px] flex items-center gap-0.5 text-yellow-400 mt-0.5 ml-4">
                                <Star size={8} className="fill-yellow-400" /> {r.rating} ({r.reviews || 0})
                              </span>
                            )}
                          </td>
                          <td className="py-2.5">
                            {r.phone ? (
                              <a href={`tel:${r.phone}`} className="text-primary/80 hover:text-primary flex items-center gap-1">
                                <Phone size={9} /> {r.phone}
                              </a>
                            ) : <span className="text-destructive/60">—</span>}
                          </td>
                          <td className="py-2.5">
                            {r.email ? (
                              <a href={`mailto:${r.email}`} className="text-green-400 hover:text-green-300 hover:underline flex items-center gap-1 max-w-[180px] truncate">
                                <Mail size={9} className="shrink-0" /> {r.email}
                              </a>
                            ) : (
                              <span className="text-destructive/60 text-[10px]">
                                {r.email_status === "not_found" ? "Not found" : r.email_status === "error" ? "Error" : "—"}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 max-w-[160px]">
                            {r.core_service ? (
                              <p className="text-[11px] text-foreground/80 leading-snug truncate" title={r.core_service}>🎯 {r.core_service}</p>
                            ) : <span className="text-muted-foreground text-[10px]">—</span>}
                          </td>
                          <td className="py-2.5 max-w-[200px]">
                            {r.specific_site_flaw ? (
                              <p className="text-[11px] text-red-400/90 leading-snug" title={r.specific_site_flaw}>🔴 {r.specific_site_flaw.slice(0, 60)}{r.specific_site_flaw.length > 60 ? "..." : ""}</p>
                            ) : <span className="text-muted-foreground text-[10px]">—</span>}
                          </td>
                          <td className="py-2.5 max-w-[350px]">
                            {r.gap_status === "done" && r.gap_analysis ? (
                              <p className="text-amber-400/90 leading-snug text-[11px]">⚠ {r.gap_analysis}</p>
                            ) : r.gap_status === "error" ? (
                              <p className="text-destructive/60 text-[10px]">Analysis failed</p>
                            ) : r.gap_status === "skipped" ? (
                              <p className="text-muted-foreground text-[10px]">Skipped</p>
                            ) : (
                              <div className="flex items-center gap-1.5 text-muted-foreground">
                                <Loader2 size={10} className="animate-spin" /> Analyzing...
                              </div>
                            )}
                          </td>
                          <td className="py-2.5">
                            {r.gap_status === "done" ? (
                              <Badge className="text-[8px] bg-green-500/20 text-green-400 border-0">✓</Badge>
                            ) : r.gap_status === "error" ? (
                              <Badge className="text-[8px] bg-destructive/20 text-destructive border-0">Err</Badge>
                            ) : (
                              <Badge className="text-[8px] bg-cyan-500/20 text-cyan-400 border-0 animate-pulse">Live</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/30">
                  <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => addToPipeline(hybridResults)}>
                    <Plus size={12} /> Add All {hybridResults.length} to Pipeline
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Omni Engine Results */}
          {omniResults && (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <ShieldCheck size={14} className="text-green-400" />
                  <span className="text-green-400">Omni-Channel Results</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-2 bg-muted/20 rounded-lg">
                    <p className="text-lg font-bold text-foreground">{omniResults.total}</p>
                    <p className="text-[9px] text-muted-foreground">Found</p>
                  </div>
                  <div className="text-center p-2 bg-green-500/10 rounded-lg">
                    <p className="text-lg font-bold text-green-400">{omniResults.saved}</p>
                    <p className="text-[9px] text-muted-foreground">Saved</p>
                  </div>
                  <div className="text-center p-2 bg-red-500/10 rounded-lg">
                    <p className="text-lg font-bold text-red-400">{omniResults.discarded}</p>
                    <p className="text-[9px] text-muted-foreground">Discarded</p>
                  </div>
                </div>
                {omniResults.discarded_names?.length > 0 && (
                  <details className="text-[10px] text-muted-foreground">
                    <summary className="cursor-pointer hover:text-foreground">Show discarded ({omniResults.discarded_names.length})</summary>
                    <div className="mt-1 space-y-0.5 pl-2">
                      {omniResults.discarded_names.map((n: string, i: number) => (
                        <p key={i}>• {n} — no verified email</p>
                      ))}
                    </div>
                  </details>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════ PIPELINE TAB (Kanban) ═══════════ */}
      {mainTab === "pipeline" && (
        <div className="space-y-3">
          {/* Stats bar */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {[
              { label: "Total", value: pipelineStats.total, color: "text-foreground" },
              { label: "Has Email", value: pipelineStats.withEmail, color: "text-green-400" },
              { label: "Has Reviews", value: pipelineStats.withReviews, color: "text-yellow-400" },
              { label: "No Website", value: pipelineStats.noWebsite, color: "text-red-400" },
              { label: "Dripping", value: pipelineStats.dripping, color: "text-purple-400" },
              { label: "Drafts", value: pipelineStats.drafted, color: "text-amber-400" },
            ].map(s => (
              <div key={s.label} className="text-center p-2 bg-muted/20 rounded-lg">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Filter & Sort bar */}
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={pipelineFilter} onValueChange={(v) => setPipelineFilter(v as PipelineFilter)}>
              <SelectTrigger className="text-xs h-7 w-32"><Filter size={10} className="mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Leads</SelectItem>
                <SelectItem value="has_email" className="text-xs">✓ Has Email</SelectItem>
                <SelectItem value="no_email" className="text-xs">✗ No Email</SelectItem>
                <SelectItem value="has_website" className="text-xs">✓ Has Website</SelectItem>
                <SelectItem value="no_website" className="text-xs">✗ No Website</SelectItem>
                <SelectItem value="has_reviews" className="text-xs">⭐ Has Reviews</SelectItem>
                <SelectItem value="no_facebook" className="text-xs">✗ No Facebook</SelectItem>
                <SelectItem value="no_instagram" className="text-xs">✗ No Instagram</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pipelineSort} onValueChange={(v) => setPipelineSort(v as PipelineSort)}>
              <SelectTrigger className="text-xs h-7 w-32"><ArrowUpDown size={10} className="mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="newest" className="text-xs">Newest First</SelectItem>
                <SelectItem value="score_desc" className="text-xs">Lead Score ↓</SelectItem>
                <SelectItem value="reviews_desc" className="text-xs">Most Reviews</SelectItem>
                <SelectItem value="rating_desc" className="text-xs">Highest Rating</SelectItem>
                <SelectItem value="name_asc" className="text-xs">Name A→Z</SelectItem>
                <SelectItem value="drip_status" className="text-xs">Drip Progress</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={fetchPipeline} disabled={loadingPipeline}>
              <RefreshCw size={10} className={loadingPipeline ? "animate-spin" : ""} /> Refresh
            </Button>
            <span className="text-[10px] text-muted-foreground ml-auto">
              Showing {filteredPipelineLeads.length} of {pipelineLeads.length}
              {selectedPipelineIds.size > 0 && ` · ${selectedPipelineIds.size} selected`}
            </span>
          </div>

          {/* Batch Email Actions */}
          <div className="flex items-center gap-2 flex-wrap p-2 bg-muted/20 rounded-lg border border-border/30">
            <Button
              variant="outline" size="sm" className="text-xs h-7 gap-1"
              onClick={() => {
                if (selectedPipelineIds.size === filteredPipelineLeads.filter(l => !!l.email).length) {
                  setSelectedPipelineIds(new Set());
                } else {
                  setSelectedPipelineIds(new Set(filteredPipelineLeads.filter(l => !!l.email).map(l => l.id)));
                }
              }}
            >
              <CheckCircle size={10} />
              {selectedPipelineIds.size > 0 ? "Deselect All" : `Select All w/ Email (${pipelineStats.withEmail})`}
            </Button>
            <Button
              size="sm" className="text-xs h-7 gap-1 bg-amber-600 hover:bg-amber-700 text-white"
              disabled={batchProcessing}
              onClick={() => runBatchDrip("draft_all")}
            >
              {batchProcessing ? <Loader2 size={10} className="animate-spin" /> : <FileText size={10} />}
              Draft {selectedPipelineIds.size > 0 ? selectedPipelineIds.size : "All"}
            </Button>
            <Button
              size="sm" className="text-xs h-7 gap-1 bg-purple-600 hover:bg-purple-700 text-white"
              disabled={batchProcessing}
              onClick={() => runBatchDrip("send_drafted")}
            >
              {batchProcessing ? <Loader2 size={10} className="animate-spin" /> : <Send size={10} />}
              Send Drafted
            </Button>
            <Button
              size="sm" className="text-xs h-7 gap-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              disabled={batchProcessing}
              onClick={() => runBatchDrip("send_all")}
            >
              {batchProcessing ? <Loader2 size={10} className="animate-spin" /> : <Mail size={10} />}
              Generate & Send {selectedPipelineIds.size > 0 ? selectedPipelineIds.size : "All"}
            </Button>
            <div className="ml-auto flex items-center gap-1.5">
              <Button
                variant="outline" size="sm" className="text-xs h-7 gap-1 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                disabled={batchProcessing}
                onClick={clearDuplicates}
              >
                Clear Dupes
              </Button>
              <Button
                variant="outline" size="sm" className="text-xs h-7 gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                disabled={archiving}
                onClick={archiveSentLeads}
              >
                {archiving ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
                Archive Sent ({pipelineLeads.filter(l => l.pipeline_stage === "outreach_sent").length})
              </Button>
              {selectedPipelineIds.size > 0 && (
                <Button
                  variant="outline" size="sm" className="text-xs h-7 gap-1 border-red-500/30 text-red-400 hover:bg-red-500/10"
                  disabled={batchProcessing}
                  onClick={bulkDeletePipeline}
                >
                  <Trash2 size={10} /> Delete {selectedPipelineIds.size}
                </Button>
              )}
            </div>
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
                    onDeepResearch={deepResearch}
                    onDrip={runPipelineDrip}
                    onPreviewDrip={setPreviewLead}
                    onDelete={deletePipelineLead}
                    auditingId={auditingId}
                    sendingId={sendingId}
                    researchingId={researchingId}
                    drippingId={drippingId}
                  />
                </SortableContext>
              ))}
            </div>
          </DndContext>

          {/* Drip sequence info card */}
          <Card className="border-purple-500/30 bg-purple-500/5">
            <CardContent className="py-3">
              <p className="text-xs font-semibold text-purple-400 mb-2 flex items-center gap-1.5"><Mail size={12} /> Sniper Drip Sequence (4-Step)</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { step: 1, label: "Audit Hook", desc: "Reference specific gap, offer pre-built demo" },
                  { step: 2, label: "Follow-Up", desc: "Check if they saw demo, add new observation" },
                  { step: 3, label: "Value-Add", desc: "Industry tip + new site observation" },
                  { step: 4, label: "Final Touch", desc: "Direct closing, reference original gap" },
                ].map(s => (
                  <div key={s.step} className="p-2 bg-card rounded-lg border border-border/30">
                    <p className="text-[10px] font-bold text-purple-400">Step {s.step}: {s.label}</p>
                    <p className="text-[9px] text-muted-foreground mt-0.5">{s.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {pipelineLeads.length === 0 && !loadingPipeline && (
            <Card className="border-border/40 border-dashed">
              <CardContent className="py-12 text-center">
                <p className="text-sm text-muted-foreground">No leads in pipeline yet. Use <strong>Search</strong> to find businesses and add them.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ═══════════ SENT LOG TAB ═══════════ */}
      {mainTab === "sent" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <Mail size={14} className="text-primary" /> Prospect Email Log
            </h3>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px]">{sentEmails.length} emails</Badge>
              <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={fetchSentEmails} disabled={loadingSent}>
                <RefreshCw size={10} className={loadingSent ? "animate-spin" : ""} /> Refresh
              </Button>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { label: "Total Sent", value: sentEmails.length, color: "text-foreground" },
              { label: "Step 1", value: sentEmails.filter((e: any) => e.drip_step === 1).length, color: "text-blue-400" },
              { label: "Step 2", value: sentEmails.filter((e: any) => e.drip_step === 2).length, color: "text-purple-400" },
              { label: "Step 3+", value: sentEmails.filter((e: any) => (e.drip_step || 0) >= 3).length, color: "text-green-400" },
            ].map(s => (
              <div key={s.label} className="text-center p-2 bg-muted/20 rounded-lg">
                <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>

          {loadingSent ? (
            <div className="text-center py-8">
              <Loader2 className="animate-spin mx-auto text-muted-foreground" size={20} />
              <p className="text-xs text-muted-foreground mt-2">Loading sent emails...</p>
            </div>
          ) : sentEmails.length === 0 ? (
            <Card className="border-border/40 border-dashed">
              <CardContent className="py-12 text-center">
                <Mail size={24} className="mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground">No emails sent yet. Use the Pipeline tab to draft and send emails.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
              {sentEmails.map((email: any) => (
                <Card key={email.id} className="border-border/30">
                  <CardContent className="p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Badge className="text-[8px] bg-green-500/20 text-green-400 border-0">{email.status || "sent"}</Badge>
                          <Badge variant="outline" className="text-[8px]">Step {email.drip_step || "?"}</Badge>
                          {email.resend_id && (
                            <span className="text-[8px] text-muted-foreground font-mono">{email.resend_id.slice(0, 12)}...</span>
                          )}
                        </div>
                        <p className="text-xs font-semibold truncate">{email.business_name || "Unknown"}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{email.recipient_email}</p>
                        {email.subject && (
                          <p className="text-[10px] text-foreground/70 truncate mt-0.5">📧 {email.subject}</p>
                        )}
                      </div>
                      <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                        {email.sent_at ? new Date(email.sent_at).toLocaleString("en-US", {
                          month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
                        }) : "—"}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
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
                      {lead.phone && (
                        <a href={`tel:${lead.phone}`} className="text-[10px] text-primary/80 hover:text-primary flex items-center gap-0.5">
                          <Phone size={8} /> {lead.phone}
                        </a>
                      )}
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

      {/* ═══ Drip Preview Dialog ═══ */}
      <Dialog open={!!previewLead} onOpenChange={(open) => { if (!open) setPreviewLead(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2">
              <Eye size={14} /> Draft Preview — {previewLead?.business_name}
            </DialogTitle>
          </DialogHeader>
          {previewLead && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs text-muted-foreground">Subject</Label>
                <p className="text-sm font-medium mt-1">{previewLead.drip_subject || "No subject"}</p>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Body</Label>
                <div className="mt-1 p-3 bg-muted/20 rounded-lg text-sm whitespace-pre-line leading-relaxed">
                  {previewLead.drip_body || "No body"}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <p className="text-[10px] text-muted-foreground">Sending to: {previewLead.email}</p>
                <DripBadge step={previewLead.drip_step + 1} status="active" />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 text-xs gap-1"
                  disabled={drippingId === previewLead.id}
                  onClick={() => {
                    runPipelineDrip(previewLead, "draft");
                    setPreviewLead(null);
                  }}
                >
                  <RefreshCw size={12} /> Re-Draft
                </Button>
                <Button
                  className="flex-1 text-xs gap-1"
                  disabled={drippingId === previewLead.id}
                  onClick={() => {
                    runPipelineDrip(previewLead, "send_existing");
                    setPreviewLead(null);
                  }}
                >
                  <Send size={12} /> Approve & Send
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Search, Mail, Zap, Users, TrendingUp, Play, RefreshCw, Loader2,
  Pencil, Send, Trash2, Filter, ArrowUpDown, ArrowDown, ArrowUp,
  Building2, Wrench, Stethoscope, Globe, Phone, MapPin, Star,
  Expand, Minimize, Megaphone, Rss, MessageSquare, Receipt, CalendarX,
  Hammer, Home, UserPlus
} from "lucide-react";

// ── Constants ──
const INDUSTRIES = [
  "plumber", "electrician", "roofer", "HVAC contractor", "auto repair shop",
  "cleaning service", "landscaper", "contractor", "painter", "handyman",
  "dentist", "law firm", "medical clinic", "real estate agent", "salon / barbershop",
  "restaurant", "fitness studio", "accountant", "deck builder",
  "machine shop", "metal fabrication shop", "CNC machining service",
  "tool and die maker", "injection molding company", "sheet metal fabrication",
  "precision machining", "aerospace manufacturer", "automotive parts manufacturer",
  "stamping company", "wire EDM service", "grinding shop",
  "Swiss screw machining", "prototype machining", "die casting company",
  "forging company", "gear manufacturer", "spring manufacturer",
  "tube bending shop", "laser cutting service", "waterjet cutting service",
  "powder coating service", "anodizing / plating shop", "contract manufacturer",
  "fixture / jig builder", "mold maker", "industrial maintenance service",
  "welding shop", "industrial supply distributor", "packaging manufacturer",
];

const CITIES = [
  "Detroit MI", "Grosse Pointe MI", "Harper Woods MI", "Eastpointe MI",
  "St. Clair Shores MI", "Warren MI", "Roseville MI", "Sterling Heights MI",
  "Royal Oak MI", "Ferndale MI", "Dearborn MI", "Livonia MI", "Cleveland OH",
];

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
  // extra fields kept for editing
  raw: Record<string, any>;
}

type SortField = "lead_score" | "email" | "created_at" | "business_name";
type SortDir = "asc" | "desc";

interface RunResult { found: number; queued: number; skipped: number; message: string; }
interface DripResult { sent: number; total: number; errors?: number; message: string; }

// ── Normalize functions per table ──
function normalizeOutreach(r: any): UnifiedLead {
  return {
    id: r.id, source_table: "outreach_leads", business_name: r.business_name,
    contact_name: r.owner_name, email: r.email, phone: r.phone,
    city: r.city, state: null, industry: r.industry, website: r.website,
    status: r.status, lead_score: r.lead_score, notes: r.notes,
    created_at: r.created_at, raw: r,
  };
}
function normalizeContractorLead(r: any): UnifiedLead {
  return {
    id: r.id, source_table: "contractor_leads", business_name: r.name,
    contact_name: r.name, email: r.email, phone: r.phone,
    city: null, state: null, industry: r.project_type, website: null,
    status: r.status, lead_score: null, notes: r.message,
    created_at: r.created_at, raw: r,
  };
}
function normalizeB2B(r: any): UnifiedLead {
  return {
    id: r.id, source_table: "b2b_clients", business_name: r.business_name,
    contact_name: r.owner_name, email: r.email, phone: r.phone,
    city: r.city, state: r.state, industry: r.industry, website: r.website,
    status: r.source || "cataloged", lead_score: null, notes: r.notes,
    created_at: r.created_at, raw: r,
  };
}
function normalizeWebDesign(r: any): UnifiedLead {
  return {
    id: r.id, source_table: "web_design_leads", business_name: r.business || r.name || "Unknown",
    contact_name: r.name, email: r.email, phone: null,
    city: null, state: null, industry: "web design", website: r.site_url,
    status: r.status, lead_score: null, notes: r.notes || r.description,
    created_at: r.created_at, raw: r,
  };
}

// ── Component ──
export default function AdminProspector() {
  const [activeTab, setActiveTab] = useState("prospects");

  // Prospecting controls
  const [industry, setIndustry] = useState("plumber");
  const [city, setCity] = useState("Grosse Pointe MI");
  const [limit, setLimit] = useState("10");
  const [running, setRunning] = useState(false);
  const [dripRunning, setDripRunning] = useState(false);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);
  const [lastDrip, setLastDrip] = useState<DripResult | null>(null);

  // Unified lead state
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
  const [sendingId, setSendingId] = useState<string | null>(null);

  // ── Data fetchers ──
  const fetchProspects = async () => {
    const { data } = await supabase.from("outreach_leads").select("*").order("created_at", { ascending: false }).limit(500);
    return (data || []).map(normalizeOutreach);
  };
  const fetchContractorLeads = async () => {
    const { data } = await supabase.from("contractor_leads").select("*").order("created_at", { ascending: false }).limit(500);
    return (data || []).map(normalizeContractorLead);
  };
  const fetchB2BClients = async () => {
    const { data } = await supabase.from("b2b_clients").select("*").order("created_at", { ascending: false }).limit(500);
    return (data || []).map(normalizeB2B);
  };
  const fetchWebDesignLeads = async () => {
    const { data } = await supabase.from("web_design_leads").select("*").order("created_at", { ascending: false }).limit(500);
    return (data || []).map(normalizeWebDesign);
  };

  const fetchLeads = async () => {
    setLoadingLeads(true);
    try {
      let results: UnifiedLead[] = [];
      if (activeTab === "prospects") results = await fetchProspects();
      else if (activeTab === "contractor") results = await fetchContractorLeads();
      else if (activeTab === "dental") results = await fetchB2BClients();
      else if (activeTab === "webdesign") results = await fetchWebDesignLeads();
      else if (activeTab === "all") {
        const [a, b, c, d] = await Promise.all([fetchProspects(), fetchContractorLeads(), fetchB2BClients(), fetchWebDesignLeads()]);
        results = [...a, ...b, ...c, ...d];
      }
      setLeads(results);
    } catch { toast.error("Failed to load leads"); }
    finally { setLoadingLeads(false); }
  };

  useEffect(() => { fetchLeads(); }, [activeTab]);

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
      result = result.filter(l =>
        l.business_name.toLowerCase().includes(q) ||
        (l.contact_name || "").toLowerCase().includes(q) ||
        (l.email || "").toLowerCase().includes(q) ||
        (l.phone || "").includes(q)
      );
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

  // ── Actions ──
  const runProspecting = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("prospect-local-businesses", { body: { industry, city, limit: parseInt(limit, 10) } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLastRun(data);
      toast.success(`Prospecting complete: ${data.queued} leads added`);
      fetchLeads();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Prospecting failed"); }
    finally { setRunning(false); }
  };

  const runDrip = async () => {
    setDripRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("web-design-drip", { body: {} });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLastDrip(data);
      toast.success(`Drip complete: ${data.sent} emails sent`);
      fetchLeads();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Drip failed"); }
    finally { setDripRunning(false); }
  };

  const sendOneEmail = async (lead: UnifiedLead) => {
    if (!lead.email) { toast.error("No email for this lead"); return; }
    setSendingId(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke("web-design-drip", { body: { leadId: lead.id } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Email sent to ${lead.business_name}`);
      fetchLeads();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Send failed"); }
    finally { setSendingId(null); }
  };

  const updateLead = async (lead: UnifiedLead) => {
    try {
      if (lead.source_table === "outreach_leads") {
        const { error } = await supabase.from("outreach_leads").update({
          business_name: lead.business_name, email: lead.email, phone: lead.phone,
          industry: lead.industry, city: lead.city, notes: lead.notes, status: lead.status,
        } as any).eq("id", lead.id);
        if (error) throw error;
      } else if (lead.source_table === "contractor_leads") {
        const { error } = await supabase.from("contractor_leads").update({
          name: lead.business_name, email: lead.email, phone: lead.phone,
          project_type: lead.industry, status: lead.status,
        } as any).eq("id", lead.id);
        if (error) throw error;
      } else if (lead.source_table === "b2b_clients") {
        const { error } = await supabase.from("b2b_clients").update({
          business_name: lead.business_name, email: lead.email!, phone: lead.phone,
          industry: lead.industry, city: lead.city, state: lead.state, notes: lead.notes,
        } as any).eq("id", lead.id);
        if (error) throw error;
      } else if (lead.source_table === "web_design_leads") {
        const { error } = await supabase.from("web_design_leads").update({
          business: lead.business_name, email: lead.email, notes: lead.notes, status: lead.status || "new",
        } as any).eq("id", lead.id);
        if (error) throw error;
      }
      toast.success("Lead updated");
      setEditingLead(null);
      fetchLeads();
    } catch { toast.error("Update failed"); }
  };

  const deleteLead = async (lead: UnifiedLead) => {
    try {
      if (lead.source_table === "outreach_leads") {
        const { error } = await supabase.from("outreach_leads").delete().eq("id", lead.id);
        if (error) throw error;
      } else if (lead.source_table === "contractor_leads") {
        const { error } = await supabase.from("contractor_leads").delete().eq("id", lead.id);
        if (error) throw error;
      } else if (lead.source_table === "b2b_clients") {
        const { error } = await supabase.from("b2b_clients").delete().eq("id", lead.id);
        if (error) throw error;
      } else if (lead.source_table === "web_design_leads") {
        const { error } = await supabase.from("web_design_leads").delete().eq("id", lead.id);
        if (error) throw error;
      }
      toast.success("Lead deleted");
      fetchLeads();
    } catch { toast.error("Delete failed"); }
  };

  const leadsWithEmail = filtered.filter(l => l.email);
  const sourceLabel: Record<string, string> = {
    outreach_leads: "Prospect", contractor_leads: "Contractor", b2b_clients: "B2B/Dental", web_design_leads: "Web Design",
  };
  const sourceBadgeColor: Record<string, string> = {
    outreach_leads: "bg-primary/20 text-primary", contractor_leads: "bg-orange-500/20 text-orange-400",
    b2b_clients: "bg-blue-500/20 text-blue-400", web_design_leads: "bg-purple-500/20 text-purple-400",
  };

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <Button variant="ghost" size="sm" className="h-6 text-[10px] px-1.5 gap-0.5" onClick={() => toggleSort(field)}>
      {label}
      {sortField === field ? (sortDir === "asc" ? <ArrowUp size={10} /> : <ArrowDown size={10} />) : <ArrowUpDown size={10} className="opacity-40" />}
    </Button>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Lead Command Center</h2>
          <p className="text-xs text-muted-foreground">Prospect, search, sort & outreach across all lead sources</p>
        </div>
        <Badge variant="outline" className="text-xs">Unified CRM</Badge>
      </div>

      {/* Prospecting + Drip Controls */}
      <div className="grid sm:grid-cols-2 gap-4">
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search size={14} className="text-primary" /> Prospect for New Leads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label className="text-xs">Industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger className="text-xs h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{INDUSTRIES.map(i => <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">City / Area</Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="text-xs h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{CITIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Max Leads</Label>
              <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger className="text-xs h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>{["5", "10", "15", "25"].map(l => <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <Button onClick={runProspecting} disabled={running} className="w-full text-xs font-bold" size="sm">
              {running ? <><Loader2 size={12} className="animate-spin mr-1.5" /> Prospecting...</> : <><Play size={12} className="mr-1.5" /> Run Prospecting</>}
            </Button>
            {lastRun && (
              <div className="grid grid-cols-3 gap-2 pt-2 border-t border-border/40">
                <div className="text-center"><div className="text-lg font-black text-primary">{lastRun.found}</div><div className="text-[9px] text-muted-foreground uppercase tracking-widest">Found</div></div>
                <div className="text-center"><div className="text-lg font-black text-green-500">{lastRun.queued}</div><div className="text-[9px] text-muted-foreground uppercase tracking-widest">Added</div></div>
                <div className="text-center"><div className="text-lg font-black text-muted-foreground">{lastRun.skipped}</div><div className="text-[9px] text-muted-foreground uppercase tracking-widest">Skipped</div></div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail size={14} className="text-primary" /> Drip Email Sequence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground text-xs">The 4-step sequence:</p>
              {[
                { day: "Day 1", label: "\"Your competitors are getting calls you're not\"" },
                { day: "Day 4", label: "\"Quick follow-up + demo link\"" },
                { day: "Day 8", label: "\"I ran a quick check on your online presence\"" },
                { day: "Day 15", label: "\"Last message from me\"" },
              ].map(step => (
                <div key={step.day} className="flex items-start gap-2 p-1.5 bg-muted/30 rounded-lg">
                  <Badge variant="outline" className="text-[9px] shrink-0 px-1.5">{step.day}</Badge>
                  <span className="text-[10px] italic">{step.label}</span>
                </div>
              ))}
            </div>
            <Button onClick={runDrip} disabled={dripRunning} variant="outline" className="w-full text-xs font-bold" size="sm">
              {dripRunning ? <><Loader2 size={12} className="animate-spin mr-1.5" /> Processing...</> : <><RefreshCw size={12} className="mr-1.5" /> Process Drip Now</>}
            </Button>
            {lastDrip && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
                <div className="text-center"><div className="text-lg font-black text-primary">{lastDrip.sent}</div><div className="text-[9px] text-muted-foreground uppercase tracking-widest">Sent</div></div>
                <div className="text-center"><div className="text-lg font-black text-muted-foreground">{lastDrip.total}</div><div className="text-[9px] text-muted-foreground uppercase tracking-widest">Eligible</div></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Unified Lead Catalog ── */}
      <Card className="border-border/40">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users size={14} className="text-primary" /> Lead Catalog
              <Badge variant="secondary" className="text-[10px] ml-1">{filtered.length} results</Badge>
              <Badge className="text-[10px] ml-1 bg-green-500/20 text-green-400">{leadsWithEmail.length} with email</Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchLeads} className="text-xs h-7">
              <RefreshCw size={10} className={loadingLeads ? "animate-spin mr-1" : "mr-1"} /> Refresh
            </Button>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
            <TabsList className="h-8 w-full grid grid-cols-5 text-[10px]">
              <TabsTrigger value="all" className="text-[10px] px-1">
                <Globe size={10} className="mr-0.5 hidden sm:inline" /> All
              </TabsTrigger>
              <TabsTrigger value="prospects" className="text-[10px] px-1">
                <TrendingUp size={10} className="mr-0.5 hidden sm:inline" /> Prospects
              </TabsTrigger>
              <TabsTrigger value="contractor" className="text-[10px] px-1">
                <Wrench size={10} className="mr-0.5 hidden sm:inline" /> Contractor
              </TabsTrigger>
              <TabsTrigger value="dental" className="text-[10px] px-1">
                <Stethoscope size={10} className="mr-0.5 hidden sm:inline" /> B2B
              </TabsTrigger>
              <TabsTrigger value="webdesign" className="text-[10px] px-1">
                <Building2 size={10} className="mr-0.5 hidden sm:inline" /> Web Design
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Search + Filters */}
          <div className="space-y-2 mt-3">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search name, email, phone..."
                className="text-xs h-8 pl-8"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="text-xs h-7 w-28"><Filter size={10} className="mr-1" /><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">All Status</SelectItem>
                  <SelectItem value="new" className="text-xs">New</SelectItem>
                  <SelectItem value="emailed" className="text-xs">Emailed</SelectItem>
                  <SelectItem value="responded" className="text-xs">Responded</SelectItem>
                  <SelectItem value="closed" className="text-xs">Closed</SelectItem>
                  <SelectItem value="cataloged" className="text-xs">Cataloged</SelectItem>
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
              {uniqueAreas.length > 0 && (
                <Select value={filterArea} onValueChange={setFilterArea}>
                  <SelectTrigger className="text-xs h-7 w-36"><MapPin size={10} className="mr-1" /><SelectValue placeholder="All Areas" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Areas</SelectItem>
                    {uniqueAreas.map(a => <SelectItem key={a} value={a} className="text-xs">{a}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              {uniqueIndustries.length > 0 && (
                <Select value={filterIndustry} onValueChange={setFilterIndustry}>
                  <SelectTrigger className="text-xs h-7 w-36"><SelectValue placeholder="All Industries" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">All Industries</SelectItem>
                    {uniqueIndustries.map(ind => <SelectItem key={ind!} value={ind!} className="text-xs">{ind}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </div>
            {/* Sort controls */}
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
          <div className="max-h-[500px] overflow-y-auto space-y-1">
            {filtered.length === 0 && !loadingLeads && (
              <p className="text-xs text-muted-foreground text-center py-8">No leads found matching your filters.</p>
            )}
            {loadingLeads && (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
            )}
            {filtered.map(lead => (
              <div key={`${lead.source_table}-${lead.id}`} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-semibold truncate">{lead.business_name}</span>
                    {/* Source badge */}
                    {activeTab === "all" && (
                      <Badge className={`text-[8px] px-1 h-3.5 border-0 ${sourceBadgeColor[lead.source_table] || ""}`}>
                        {sourceLabel[lead.source_table]}
                      </Badge>
                    )}
                    {lead.status && (
                      <Badge variant={lead.status.toLowerCase() === "emailed" ? "default" : "secondary"} className="text-[9px] px-1.5 h-4">
                        {lead.status}
                      </Badge>
                    )}
                    {lead.lead_score != null && (
                      <span className="text-[9px] flex items-center gap-0.5">
                        <Star size={9} className={lead.lead_score >= 70 ? "text-yellow-400 fill-yellow-400" : lead.lead_score >= 40 ? "text-orange-400" : "text-muted-foreground"} />
                        {lead.lead_score}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                    {lead.email && <span className="text-[10px] text-primary/80 truncate">{lead.email}</span>}
                    {!lead.email && <span className="text-[10px] text-destructive/60 italic">no email</span>}
                    {(lead.city || lead.state) && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <MapPin size={8} /> {[lead.city, lead.state].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {lead.phone && (
                      <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                        <Phone size={8} /> {lead.phone}
                      </span>
                    )}
                    {lead.industry && <span className="text-[10px] text-muted-foreground">{lead.industry}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                  {/* Edit */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setEditingLead({ ...lead })}>
                        <Pencil size={12} />
                      </Button>
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
                          <div className="grid grid-cols-2 gap-2">
                            <div><Label className="text-xs">City</Label><Input className="text-xs h-8 mt-1" value={editingLead.city || ""} onChange={e => setEditingLead({ ...editingLead, city: e.target.value })} /></div>
                            <div>
                              <Label className="text-xs">Status</Label>
                              <Select value={editingLead.status || "new"} onValueChange={v => setEditingLead({ ...editingLead, status: v })}>
                                <SelectTrigger className="text-xs h-8 mt-1"><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  {["new", "Emailed", "Responded", "Closed", "Not Interested", "cataloged"].map(s => (
                                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div><Label className="text-xs">Notes</Label><Textarea className="text-xs mt-1" rows={3} value={editingLead.notes || ""} onChange={e => setEditingLead({ ...editingLead, notes: e.target.value })} /></div>
                          <Badge variant="outline" className="text-[9px]">Source: {sourceLabel[editingLead.source_table]}</Badge>
                          <Button onClick={() => updateLead(editingLead)} className="w-full text-xs" size="sm">Save Changes</Button>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                  {/* One-click email */}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-primary" disabled={!lead.email || sendingId === lead.id} onClick={() => sendOneEmail(lead)} title="Send drip email">
                    {sendingId === lead.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  </Button>
                  {/* Delete */}
                  <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive" onClick={() => { if (confirm(`Delete ${lead.business_name}?`)) deleteLead(lead); }}>
                    <Trash2 size={12} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* How It Works */}
      <Card className="border-border/40 bg-muted/20">
        <CardContent className="p-5">
          <h3 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2">
            <Zap size={12} className="text-primary" /> How the Machine Works
          </h3>
          <div className="grid sm:grid-cols-4 gap-3">
            {[
              { icon: Search, label: "Firecrawl searches Google for businesses without good websites" },
              { icon: TrendingUp, label: "AI scores each business's digital gap (0–100)" },
              { icon: Users, label: "Leads from all sources feed into one unified catalog" },
              { icon: Mail, label: "4-step drip + one-click outreach from any tab" },
            ].map((s, i) => (
              <div key={i} className="text-center">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <s.icon size={14} className="text-primary" />
                </div>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{s.label}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

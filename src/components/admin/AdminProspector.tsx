import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Search, Mail, Zap, Users, TrendingUp, Play, RefreshCw, Loader2, Eye, Pencil, Send, Trash2, Filter } from "lucide-react";

const INDUSTRIES = [
  "plumber", "electrician", "roofer", "HVAC contractor", "auto repair shop",
  "cleaning service", "landscaper", "contractor", "painter", "handyman",
  "dentist", "law firm", "medical clinic", "real estate agent", "salon / barbershop",
  "restaurant", "fitness studio", "accountant", "deck builder",
];

const CITIES = [
  "Detroit MI", "Grosse Pointe MI", "Harper Woods MI", "Eastpointe MI",
  "St. Clair Shores MI", "Warren MI", "Roseville MI", "Sterling Heights MI",
  "Royal Oak MI", "Ferndale MI", "Dearborn MI", "Livonia MI", "Cleveland OH",
];

interface OutreachLead {
  id: string;
  business_name: string;
  owner_name: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  industry: string | null;
  website: string | null;
  website_status: string | null;
  status: string | null;
  lead_score: number | null;
  notes: string | null;
  ai_drafted_subject: string | null;
  ai_drafted_pitch: string | null;
  created_at: string | null;
  last_contact_date: string | null;
}

interface RunResult { found: number; queued: number; skipped: number; message: string; }
interface DripResult { sent: number; total: number; errors?: number; message: string; }

export default function AdminProspector() {
  const [industry, setIndustry] = useState("plumber");
  const [city, setCity] = useState("Grosse Pointe MI");
  const [limit, setLimit] = useState("10");
  const [running, setRunning] = useState(false);
  const [dripRunning, setDripRunning] = useState(false);
  const [lastRun, setLastRun] = useState<RunResult | null>(null);
  const [lastDrip, setLastDrip] = useState<DripResult | null>(null);

  // Lead management state
  const [leads, setLeads] = useState<OutreachLead[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterIndustry, setFilterIndustry] = useState("all");
  const [editingLead, setEditingLead] = useState<OutreachLead | null>(null);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const fetchLeads = async () => {
    setLoadingLeads(true);
    try {
      let query = supabase
        .from("outreach_leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);

      if (filterStatus !== "all") query = query.eq("status", filterStatus);
      if (filterIndustry !== "all") query = query.eq("industry", filterIndustry);

      const { data, error } = await query;
      if (error) throw error;
      setLeads((data || []) as unknown as OutreachLead[]);
    } catch (err) {
      toast.error("Failed to load leads");
    } finally {
      setLoadingLeads(false);
    }
  };

  useEffect(() => { fetchLeads(); }, [filterStatus, filterIndustry]);

  const runProspecting = async () => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("prospect-local-businesses", {
        body: { industry, city, limit: parseInt(limit, 10) },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setLastRun(data);
      toast.success(`Prospecting complete: ${data.queued} leads added`);
      fetchLeads();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Prospecting failed");
    } finally {
      setRunning(false);
    }
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
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Drip failed");
    } finally {
      setDripRunning(false);
    }
  };

  const sendOneEmail = async (lead: OutreachLead) => {
    if (!lead.email) { toast.error("No email for this lead"); return; }
    setSendingId(lead.id);
    try {
      const { data, error } = await supabase.functions.invoke("web-design-drip", {
        body: { leadId: lead.id },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Email sent to ${lead.business_name}`);
      fetchLeads();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Send failed");
    } finally {
      setSendingId(null);
    }
  };

  const updateLead = async (lead: OutreachLead) => {
    try {
      const { error } = await supabase
        .from("outreach_leads")
        .update({
          business_name: lead.business_name,
          email: lead.email,
          phone: lead.phone,
          industry: lead.industry,
          city: lead.city,
          notes: lead.notes,
          status: lead.status,
        } as any)
        .eq("id", lead.id);
      if (error) throw error;
      toast.success("Lead updated");
      setEditingLead(null);
      fetchLeads();
    } catch (err) {
      toast.error("Update failed");
    }
  };

  const deleteLead = async (id: string) => {
    try {
      const { error } = await supabase.from("outreach_leads").delete().eq("id", id);
      if (error) throw error;
      toast.success("Lead deleted");
      fetchLeads();
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  const leadsWithEmail = leads.filter(l => l.email);
  const newLeads = leads.filter(l => l.status === "new" || l.status === "New");
  const emailedLeads = leads.filter(l => l.status === "Emailed");
  const uniqueIndustries = [...new Set(leads.map(l => l.industry).filter(Boolean))];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Automated Lead Prospector</h2>
          <p className="text-xs text-muted-foreground">Find businesses without good websites and auto-queue outreach</p>
        </div>
        <Badge variant="outline" className="text-xs">95% Automated</Badge>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {/* Prospecting Controls */}
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Search size={14} className="text-primary" /> Prospect for New Leads
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-xs">Industry</Label>
              <Select value={industry} onValueChange={setIndustry}>
                <SelectTrigger className="text-xs h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INDUSTRIES.map(i => <SelectItem key={i} value={i} className="text-xs">{i}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">City / Area</Label>
              <Select value={city} onValueChange={setCity}>
                <SelectTrigger className="text-xs h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CITIES.map(c => <SelectItem key={c} value={c} className="text-xs">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Max Leads to Find</Label>
              <Select value={limit} onValueChange={setLimit}>
                <SelectTrigger className="text-xs h-8 mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["5", "10", "15", "25"].map(l => <SelectItem key={l} value={l} className="text-xs">{l} leads</SelectItem>)}
                </SelectContent>
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

        {/* Drip Controls */}
        <Card className="border-border/40">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail size={14} className="text-primary" /> Drip Email Sequence
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 text-xs text-muted-foreground">
              <p className="font-medium text-foreground text-xs">The 4-step sequence:</p>
              {[
                { day: "Day 1", label: "\"Your competitors are getting calls you're not\"" },
                { day: "Day 4", label: "\"Quick follow-up + demo link\"" },
                { day: "Day 8", label: "\"I ran a quick check on your online presence\"" },
                { day: "Day 15", label: "\"Last message from me\"" },
              ].map(step => (
                <div key={step.day} className="flex items-start gap-2 p-2 bg-muted/30 rounded-lg">
                  <Badge variant="outline" className="text-[9px] shrink-0 px-1.5">{step.day}</Badge>
                  <span className="text-[10px] italic">{step.label}</span>
                </div>
              ))}
            </div>
            <Button onClick={runDrip} disabled={dripRunning} variant="outline" className="w-full text-xs font-bold" size="sm">
              {dripRunning ? <><Loader2 size={12} className="animate-spin mr-1.5" /> Processing Drip...</> : <><RefreshCw size={12} className="mr-1.5" /> Process Drip Now</>}
            </Button>
            <p className="text-[10px] text-muted-foreground">
              Emails all "new" leads with an email address. Respects timing — won't double-send.
            </p>
            {lastDrip && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/40">
                <div className="text-center"><div className="text-lg font-black text-primary">{lastDrip.sent}</div><div className="text-[9px] text-muted-foreground uppercase tracking-widest">Sent</div></div>
                <div className="text-center"><div className="text-lg font-black text-muted-foreground">{lastDrip.total}</div><div className="text-[9px] text-muted-foreground uppercase tracking-widest">Eligible</div></div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Lead Roster ── */}
      <Card className="border-border/40">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <Users size={14} className="text-primary" /> Lead Roster
              <Badge variant="secondary" className="text-[10px] ml-1">{leads.length} total</Badge>
              <Badge className="text-[10px] ml-1 bg-green-500/20 text-green-400">{leadsWithEmail.length} with email</Badge>
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={fetchLeads} className="text-xs h-7">
              <RefreshCw size={10} className={loadingLeads ? "animate-spin mr-1" : "mr-1"} /> Refresh
            </Button>
          </div>
          <div className="flex gap-2 mt-2">
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="text-xs h-7 w-32"><Filter size={10} className="mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Status</SelectItem>
                <SelectItem value="new" className="text-xs">New</SelectItem>
                <SelectItem value="Emailed" className="text-xs">Emailed</SelectItem>
                <SelectItem value="Responded" className="text-xs">Responded</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterIndustry} onValueChange={setFilterIndustry}>
              <SelectTrigger className="text-xs h-7 w-40"><SelectValue placeholder="All Industries" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all" className="text-xs">All Industries</SelectItem>
                {uniqueIndustries.map(ind => (
                  <SelectItem key={ind!} value={ind!} className="text-xs">{ind}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          <div className="max-h-[500px] overflow-y-auto space-y-1">
            {leads.length === 0 && !loadingLeads && (
              <p className="text-xs text-muted-foreground text-center py-8">No leads found. Run prospecting to find some!</p>
            )}
            {loadingLeads && (
              <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>
            )}
            {leads.map(lead => (
              <div key={lead.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/20 hover:bg-muted/40 transition-colors group">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold truncate">{lead.business_name}</span>
                    <Badge variant={lead.status === "Emailed" ? "default" : lead.status === "new" ? "secondary" : "outline"} className="text-[9px] px-1.5 h-4">
                      {lead.status}
                    </Badge>
                    {lead.industry && <span className="text-[10px] text-muted-foreground">{lead.industry}</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    {lead.email && <span className="text-[10px] text-primary/80 truncate">{lead.email}</span>}
                    {lead.city && <span className="text-[10px] text-muted-foreground">{lead.city}</span>}
                    {lead.phone && <span className="text-[10px] text-muted-foreground">{lead.phone}</span>}
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
                                  {["new", "Emailed", "Responded", "Closed", "Not Interested"].map(s => (
                                    <SelectItem key={s} value={s} className="text-xs">{s}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          <div><Label className="text-xs">Notes</Label><Textarea className="text-xs mt-1" rows={3} value={editingLead.notes || ""} onChange={e => setEditingLead({ ...editingLead, notes: e.target.value })} /></div>
                          <Button onClick={() => updateLead(editingLead)} className="w-full text-xs" size="sm">Save Changes</Button>
                        </div>
                      )}
                    </DialogContent>
                  </Dialog>
                  {/* One-click email */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-primary"
                    disabled={!lead.email || sendingId === lead.id}
                    onClick={() => sendOneEmail(lead)}
                    title="Send drip email"
                  >
                    {sendingId === lead.id ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  </Button>
                  {/* Delete */}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 text-destructive"
                    onClick={() => { if (confirm(`Delete ${lead.business_name}?`)) deleteLead(lead.id); }}
                  >
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
              { icon: Users, label: "High-gap leads are added to your CRM with a custom outreach email" },
              { icon: Mail, label: "4-step drip sequence runs automatically over 15 days" },
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

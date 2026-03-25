import { useState, memo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Copy, Check, Trash2, Users, Mail, TrendingUp, DollarSign, CircleDot } from "lucide-react";

type Industry = "Plumber" | "Electrician" | "Landscaper" | "Roofer" | "Lawyer" | "MedSpa" | "Other";
type WebsiteStatus = "None" | "Outdated" | "Basic" | "Good";
type LeadStatus = "New" | "Emailed" | "Responded" | "Closed" | "Lost";

interface Lead {
  id: string;
  business_name: string;
  owner_name: string | null;
  city: string | null;
  industry: Industry | null;
  phone: string | null;
  email: string | null;
  website_status: WebsiteStatus | null;
  status: LeadStatus;
  last_contact_date: string | null;
  notes: string | null;
  created_at: string;
}

const STATUS_CYCLE: LeadStatus[] = ["New", "Emailed", "Responded", "Closed", "Lost"];
const STATUS_COLORS: Record<LeadStatus, string> = {
  New: "bg-muted text-muted-foreground",
  Emailed: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Responded: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  Closed: "bg-green-500/20 text-green-400 border-green-500/30",
  Lost: "bg-red-500/20 text-red-400 border-red-500/30",
};

const INDUSTRIES: Industry[] = ["Plumber", "Electrician", "Landscaper", "Roofer", "Lawyer", "MedSpa", "Other"];
const WEBSITE_STATUSES: WebsiteStatus[] = ["None", "Outdated", "Basic", "Good"];

function getEmailTemplate(lead: Lead): { subject: string; body: string } {
  const name = lead.owner_name || "there";
  const biz = lead.business_name;
  const city = lead.city || "your area";
  const ind = lead.industry?.toLowerCase() || "trades";
  const demoMap: Record<string, string> = {
    Plumber: "https://mattmichelstraining.com/demo-plumber",
    Electrician: "https://mattmichelstraining.com/demo-electrician",
    Landscaper: "https://mattmichelstraining.com/demo-landscaping",
    Roofer: "https://mattmichelstraining.com/demo-roofing",
    Lawyer: "https://mattmichelstraining.com/demo-lawyer",
    MedSpa: "https://mattmichelstraining.com/demo-clinic",
  };
  const demo = demoMap[lead.industry ?? ""] ?? "https://mattmichelstraining.com/detroit-web-design";
  const signature = `Matt Michels\nGrosse Pointe Park, MI\n📱 313.806.4952\nmatthew.michels4@gmail.com`;

  if (lead.website_status === "None") {
    return {
      subject: `Found ${biz} on Google — couldn't find your website`,
      body: `Hi ${name},\n\nI was searching for ${ind} in ${city} and came across ${biz} — solid reviews. But I couldn't find your website anywhere.\n\nThat's costing you jobs every week. Over 75% of people search online before they call a ${ind}. If you're not showing up, they're calling someone else.\n\nI build websites for local trades businesses in Metro Detroit — fast, mobile-first, and built to make your phone ring.\n\nWhat agencies charge vs. what I charge:\n\n  Local agencies:  $2,500–$8,000 to build + $150–$300/month\n  My price:        $499 flat to build + $49/month (I handle everything)\n\nFor $49/month — less than a tank of gas — I keep it live, updated, and ranking on Google. You never have to touch it.\n\nI already built a demo so you can see exactly what yours would look like:\n👉 ${demo}\n\nNo contracts. No pressure. Just reply here or call/text me.\n\n${signature}`,
    };
  }

  if (lead.website_status === "Outdated" || lead.website_status === "Basic") {
    return {
      subject: `Quick note about ${biz}'s website`,
      body: `Hi ${name},\n\nI found ${biz} while searching for ${ind} in ${city}. Really impressive reviews. I checked your current website and wanted to be straight with you — it's not doing your business justice. On mobile it's hard to navigate, and it's likely hurting your Google ranking.\n\nI rebuild exactly this type of site for local trades businesses in Metro Detroit.\n\nWhat a redesign typically costs vs. what I charge:\n\n  Local agencies:         $2,500–$8,000 + $150–$300/month\n  DIY (Wix/Squarespace):  Your time + ~$40/month, looks generic\n  My price:               $499 flat + $49/month, I do everything\n\nHere's a live demo of what a modern ${ind} site looks like when it's done right:\n👉 ${demo}\n\nIf you like what you see, let's talk. If not, no hard feelings.\n\n${signature}`,
    };
  }

  return {
    subject: `Your ${biz} reviews are great — wanted to connect`,
    body: `Hi ${name},\n\nI came across ${biz} while searching for ${ind} in ${city}. Genuinely impressive reputation.\n\nI'm a local web designer based in Grosse Pointe Park. I work with trades businesses across Metro Detroit — $499 to build, $49/month to maintain, and I handle everything.\n\nIf you ever want a second set of eyes on your site or are thinking about a refresh, I'd love to chat.\n\n${signature}`,
  };
}

function getPhoneScript(lead: Lead): string {
  const name = lead.owner_name || "there";
  const biz = lead.business_name;
  return `Hey ${name}, this is Matt — I'm a web designer in Grosse Pointe. I was going to email you about ${biz}'s website but couldn't find an address. Can I shoot you a quick email?\n\nNo pitch, just want to show you a demo I built. 313.806.4952`;
}

function needsFollowUp(lead: Lead): boolean {
  if (lead.status !== "Emailed" || !lead.last_contact_date) return false;
  const lastContact = new Date(lead.last_contact_date);
  const daysSince = Math.floor((Date.now() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
  return daysSince >= 5;
}

const AdminOutreach = memo(() => {
  const qc = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filterIndustry, setFilterIndustry] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [scriptOpenId, setScriptOpenId] = useState<string | null>(null);
  const [scriptCopiedId, setScriptCopiedId] = useState<string | null>(null);

  const [form, setForm] = useState({
    business_name: "",
    owner_name: "",
    city: "",
    industry: "" as string,
    phone: "",
    email: "",
    website_status: "None" as string,
    notes: "",
  });

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["outreach-leads"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outreach_leads" as any)
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as unknown as Lead[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (newLead: typeof form) => {
      const { error } = await supabase.from("outreach_leads" as any).insert({
        business_name: newLead.business_name,
        owner_name: newLead.owner_name || null,
        city: newLead.city || null,
        industry: newLead.industry || null,
        phone: newLead.phone || null,
        email: newLead.email || null,
        website_status: newLead.website_status || "None",
        notes: newLead.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outreach-leads"] });
      toast({ title: "Lead added" });
      setSheetOpen(false);
      setForm({ business_name: "", owner_name: "", city: "", industry: "", phone: "", email: "", website_status: "None", notes: "" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, newStatus }: { id: string; newStatus: LeadStatus }) => {
      const updates: any = { status: newStatus };
      if (newStatus === "Emailed") updates.last_contact_date = new Date().toISOString().split("T")[0];
      const { error } = await supabase.from("outreach_leads" as any).update(updates).eq("id", id);
      if (error) throw error;
    },
    onMutate: async ({ id, newStatus }) => {
      await qc.cancelQueries({ queryKey: ["outreach-leads"] });
      const prev = qc.getQueryData<Lead[]>(["outreach-leads"]);
      qc.setQueryData<Lead[]>(["outreach-leads"], (old) =>
        (old || []).map((l) => (l.id === id ? { ...l, status: newStatus, ...(newStatus === "Emailed" ? { last_contact_date: new Date().toISOString().split("T")[0] } : {}) } : l))
      );
      return { prev };
    },
    onError: (_e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(["outreach-leads"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["outreach-leads"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("outreach_leads" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["outreach-leads"] });
      toast({ title: "Lead deleted" });
    },
  });

  const cycleStatus = (lead: Lead) => {
    const idx = STATUS_CYCLE.indexOf(lead.status);
    const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length];
    statusMutation.mutate({ id: lead.id, newStatus: next });
  };

  const copyEmail = (lead: Lead) => {
    const { subject, body } = getEmailTemplate(lead);
    navigator.clipboard.writeText(`Subject: ${subject}\n\n${body}`);
    setCopiedId(lead.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const openGmail = (lead: Lead) => {
    const { subject, body } = getEmailTemplate(lead);
    const to = lead.email || "";
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${encodeURIComponent(to)}&su=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(gmailUrl, "_blank");

    // Auto-update status to Emailed if currently New
    if (lead.status === "New") {
      statusMutation.mutate({ id: lead.id, newStatus: "Emailed" });
      toast({ title: "Gmail opened — status updated to Emailed" });
    }
  };

  const copyScript = (lead: Lead) => {
    navigator.clipboard.writeText(getPhoneScript(lead));
    setScriptCopiedId(lead.id);
    setTimeout(() => setScriptCopiedId(null), 2000);
  };

  const filtered = leads.filter((l) => {
    if (filterIndustry !== "all" && l.industry !== filterIndustry) return false;
    if (filterStatus !== "all" && l.status !== filterStatus) return false;
    return true;
  });

  const emailedCount = leads.filter((l) => l.status !== "New").length;
  const respondedCount = leads.filter((l) => l.status === "Responded" || l.status === "Closed").length;
  const closedCount = leads.filter((l) => l.status === "Closed").length;
  const responseRate = emailedCount > 0 ? Math.round((respondedCount / emailedCount) * 100) : 0;
  const mrr = closedCount * 49;
  const totalBuildFees = closedCount * 499;

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card className="border-primary/20">
            <CardContent className="p-4 flex items-center gap-3">
              <Users size={18} className="text-primary shrink-0" />
              <div>
                <p className="text-lg font-bold text-foreground">{leads.length}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Total Leads</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="p-4 flex items-center gap-3">
              <Mail size={18} className="text-primary shrink-0" />
              <div>
                <p className="text-lg font-bold text-foreground">{emailedCount}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Emails Sent</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="p-4 flex items-center gap-3">
              <TrendingUp size={18} className="text-primary shrink-0" />
              <div>
                <p className="text-lg font-bold text-foreground">{responseRate}%</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Response Rate</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-primary/20">
            <CardContent className="p-4 flex items-center gap-3">
              <DollarSign size={18} className="text-primary shrink-0" />
              <div>
                <p className={`text-lg font-bold ${mrr > 0 ? "text-primary" : "text-muted-foreground"}`}>${mrr}/mo</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Est. Monthly Recurring</p>
                {totalBuildFees > 0 && (
                  <p className="text-[9px] text-muted-foreground">+ ${totalBuildFees} collected</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Add Lead + Filters */}
        <div className="flex flex-wrap items-center gap-2">
          <Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
            <SheetTrigger asChild>
              <Button size="sm" className="gap-1"><Plus size={14} /> Add Lead</Button>
            </SheetTrigger>
            <SheetContent className="overflow-y-auto">
              <SheetHeader><SheetTitle>Add Lead</SheetTitle></SheetHeader>
              <div className="space-y-3 mt-4">
                <Input placeholder="Business Name *" value={form.business_name} onChange={(e) => setForm({ ...form, business_name: e.target.value })} />
                <Input placeholder="Owner Name" value={form.owner_name} onChange={(e) => setForm({ ...form, owner_name: e.target.value })} />
                <Input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
                <Select value={form.industry} onValueChange={(v) => setForm({ ...form, industry: v })}>
                  <SelectTrigger><SelectValue placeholder="Industry" /></SelectTrigger>
                  <SelectContent>{INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
                <Input placeholder="Email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
                <Select value={form.website_status} onValueChange={(v) => setForm({ ...form, website_status: v })}>
                  <SelectTrigger><SelectValue placeholder="Website Status" /></SelectTrigger>
                  <SelectContent>{WEBSITE_STATUSES.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}</SelectContent>
                </Select>
                <Textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                <Button className="w-full" disabled={!form.business_name || addMutation.isPending} onClick={() => addMutation.mutate(form)}>
                  {addMutation.isPending ? "Saving..." : "Save Lead"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          <Select value={filterIndustry} onValueChange={setFilterIndustry}>
            <SelectTrigger className="w-[130px] h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Industries</SelectItem>
              {INDUSTRIES.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[120px] h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              {STATUS_CYCLE.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        {isLoading ? (
          <p className="text-muted-foreground text-sm py-8 text-center">Loading leads...</p>
        ) : (
          <div className="border border-border rounded-lg overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-[10px]">Business</TableHead>
                  <TableHead className="text-[10px]">Owner</TableHead>
                  <TableHead className="text-[10px]">Industry</TableHead>
                  <TableHead className="text-[10px]">City</TableHead>
                  <TableHead className="text-[10px]">Status</TableHead>
                  <TableHead className="text-[10px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((lead) => {
                  const hasNoContact = !lead.email && !lead.phone;
                  const followUp = needsFollowUp(lead);

                  return (
                    <>
                      <TableRow key={lead.id}>
                        <TableCell className="text-xs font-medium">{lead.business_name}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{lead.owner_name || "—"}</TableCell>
                        <TableCell className="text-xs">{lead.industry || "—"}</TableCell>
                        <TableCell className="text-xs">{lead.city || "—"}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Badge
                              className={`cursor-pointer text-[10px] ${STATUS_COLORS[lead.status]}`}
                              onClick={() => cycleStatus(lead)}
                            >
                              {lead.status}
                            </Badge>
                            {followUp && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <CircleDot size={10} className="text-primary" />
                                </TooltipTrigger>
                                <TooltipContent><p className="text-xs">No response in 5+ days — consider following up</p></TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyEmail(lead)}>
                                  {copiedId === lead.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent><p className="text-xs">Copy email to clipboard</p></TooltipContent>
                            </Tooltip>

                            {lead.email ? (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openGmail(lead)}>
                                    <Mail size={12} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent><p className="text-xs">Open Gmail compose</p></TooltipContent>
                              </Tooltip>
                            ) : (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => setScriptOpenId(scriptOpenId === lead.id ? null : lead.id)}
                                  >
                                    <Mail size={12} className={hasNoContact ? "text-muted-foreground/40" : "text-muted-foreground"} />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">{hasNoContact ? "No email on file — use Copy to paste manually" : "No email — show phone script"}</p>
                                </TooltipContent>
                              </Tooltip>
                            )}

                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive"><Trash2 size={12} /></Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Delete lead?</AlertDialogTitle>
                                  <AlertDialogDescription>This will permanently remove {lead.business_name}.</AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => deleteMutation.mutate(lead.id)}>Delete</AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          </div>
                        </TableCell>
                      </TableRow>

                      {/* Phone script panel for leads with no email */}
                      {scriptOpenId === lead.id && !lead.email && (
                        <TableRow key={`${lead.id}-script`}>
                          <TableCell colSpan={6} className="bg-muted/30 border-t-0">
                            <div className="space-y-2 py-2">
                              <p className="text-xs text-muted-foreground">No email on file. Use this script to get their email by phone or text:</p>
                              <div className="bg-card border border-border rounded-md p-3 text-xs text-foreground whitespace-pre-wrap font-mono leading-relaxed">
                                {getPhoneScript(lead)}
                              </div>
                              <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => copyScript(lead)}>
                                {scriptCopiedId === lead.id ? <><Check size={12} className="text-green-500" /> Copied ✓</> : <><Copy size={12} /> Copy Script</>}
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </>
                  );
                })}
                {filtered.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">No leads yet</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
});

AdminOutreach.displayName = "AdminOutreach";
export default AdminOutreach;

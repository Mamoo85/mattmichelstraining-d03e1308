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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Plus, Copy, Check, Trash2, Users, Mail, TrendingUp, DollarSign } from "lucide-react";

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

function buildColdEmail(lead: Lead): string {
  const owner = lead.owner_name || "there";
  const biz = lead.business_name;
  const city = lead.city || "Metro Detroit";
  const industry = (lead.industry || "business").toLowerCase();
  const ws = lead.website_status;

  const demoMap: Record<string, string> = {
    plumber: "mattmichelstraining.com/demo-plumber",
    electrician: "mattmichelstraining.com/demo-electrician",
    roofer: "mattmichelstraining.com/demo-roofing",
    landscaper: "mattmichelstraining.com/demo-landscape",
    lawyer: "mattmichelstraining.com/demo-lawyer",
    medspa: "mattmichelstraining.com/demo-clinic",
  };
  const demoUrl = demoMap[industry] || "mattmichelstraining.com/detroit-web-design";

  if (ws === "None") {
    return `Subject: Found your business on Google — couldn't find your website\n\nHi ${owner},\n\nI was searching for ${industry}s in ${city} and came across ${biz} — solid reviews. But I couldn't find your website anywhere.\n\nThat's costing you jobs every week. Over 75% of people search online before they call a ${industry}.\n\nI build websites for local trades businesses in Metro Detroit.\n\nAgencies charge $2,500–$8,000. I charge $499 flat to build + $49/month and I handle everything.\n\nHere's a demo I built for a ${industry} company:\n${demoUrl}\n\nNo contracts. Just reply or call/text me.\n\nMatt Michels\nGrosse Pointe Park, MI\n313.806.4952\nmatthew.michels4@gmail.com`;
  }

  return `Subject: Quick note about ${biz}'s website\n\nHi ${owner},\n\nI found ${biz} while searching for ${industry}s in ${city}. Great reviews — I checked your current website and wanted to be straight: it's not doing your business justice on mobile and it's likely hurting your Google ranking.\n\nAgencies charge $2,500–$8,000 to fix this. I charge $499 flat + $49/month.\n\nLive demo: ${demoUrl}\n\nIf you like it, let's talk. No obligation.\n\nMatt Michels\nGrosse Pointe Park, MI\n313.806.4952\nmatthew.michels4@gmail.com`;
}

const AdminOutreach = memo(() => {
  const qc = useQueryClient();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [filterIndustry, setFilterIndustry] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form state
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
    const text = buildColdEmail(lead);
    navigator.clipboard.writeText(text);
    setCopiedId(lead.id);
    setTimeout(() => setCopiedId(null), 2000);
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

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Leads", value: leads.length, icon: Users },
          { label: "Emails Sent", value: emailedCount, icon: Mail },
          { label: "Response Rate", value: `${responseRate}%`, icon: TrendingUp },
          { label: "Monthly Revenue", value: `$${closedCount * 49}`, icon: DollarSign },
        ].map((s) => (
          <Card key={s.label} className="border-primary/20">
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon size={18} className="text-primary shrink-0" />
              <div>
                <p className="text-lg font-bold text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
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
              {filtered.map((lead) => (
                <TableRow key={lead.id}>
                  <TableCell className="text-xs font-medium">{lead.business_name}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{lead.owner_name || "—"}</TableCell>
                  <TableCell className="text-xs">{lead.industry || "—"}</TableCell>
                  <TableCell className="text-xs">{lead.city || "—"}</TableCell>
                  <TableCell>
                    <Badge
                      className={`cursor-pointer text-[10px] ${STATUS_COLORS[lead.status]}`}
                      onClick={() => cycleStatus(lead)}
                    >
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        onClick={() => copyEmail(lead)}
                        title="Copy cold email"
                      >
                        {copiedId === lead.id ? <Check size={12} className="text-green-500" /> : <Copy size={12} />}
                      </Button>
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
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground text-sm py-8">No leads yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
});

AdminOutreach.displayName = "AdminOutreach";
export default AdminOutreach;

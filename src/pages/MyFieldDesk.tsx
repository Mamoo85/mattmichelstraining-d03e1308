import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import SEOHead from "@/components/layout/SEOHead";
import DWASuiteNav from "@/components/shared/DWASuiteNav";
import ManageBillingButton from "@/components/billing/ManageBillingButton";
import EmptyDashboardState from "@/components/shared/EmptyDashboardState";
import OnboardingChecklist from "@/components/shared/OnboardingChecklist";
import JustPurchasedScreen, { isJustPurchased } from "@/components/shared/JustPurchasedScreen";
import { Briefcase, MapPin, Clock, CheckCircle2, AlertCircle, User, Download } from "lucide-react";

type Job = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  scheduled_date: string | null;
  scheduled_time: string | null;
  customer_contact_phone: string | null;
  assigned_tech_id: string | null;
  created_at: string;
  completed_at: string | null;
};

type Client = { id: string; email: string; business_name: string | null };

const STATUS_TABS = [
  { value: "active", label: "Active" },
  { value: "scheduled", label: "Scheduled" },
  { value: "completed", label: "Completed" },
  { value: "all", label: "All" },
];

function statusColor(status: string): string {
  if (status === "completed") return "bg-green-500/15 text-green-400 border-green-500/30";
  if (status === "in_progress") return "bg-blue-500/15 text-blue-400 border-blue-500/30";
  if (status === "scheduled") return "bg-amber-500/15 text-amber-400 border-amber-500/30";
  if (status === "cancelled") return "bg-red-500/15 text-red-400 border-red-500/30";
  return "bg-white/10 text-white/70 border-white/20";
}

export default function MyFieldDesk() {
  const clientEmail = new URLSearchParams(window.location.search).get("email") || "";
  const [client, setClient] = useState<Client | null>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("active");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      if (!clientEmail) {
        setError("No email in URL — open from your FieldDesk welcome email.");
        setLoading(false);
        return;
      }
      const { data: c } = await (supabase.from as any)("field_crm_clients")
        .select("id, email, business_name")
        .eq("email", clientEmail.toLowerCase())
        .maybeSingle();
      if (!c) {
        setError("No FieldDesk subscription found for this email.");
        setLoading(false);
        return;
      }
      setClient(c as Client);

      const { data: rows, error: jerr } = await (supabase.from as any)("field_service_jobs")
        .select("id, title, description, status, priority, scheduled_date, scheduled_time, customer_contact_phone, assigned_tech_id, created_at, completed_at")
        .eq("client_id", c.id)
        .order("scheduled_date", { ascending: false, nullsFirst: false })
        .limit(200);
      if (jerr) {
        toast.error("Could not load jobs");
        console.warn("[MyFieldDesk] job query failed", jerr);
      } else {
        setJobs((rows as Job[]) || []);
      }
      setLoading(false);
    })();
  }, [clientEmail]);

  const filtered = useMemo(() => {
    if (tab === "all") return jobs;
    if (tab === "active") return jobs.filter((j) => ["scheduled", "in_progress"].includes(j.status));
    if (tab === "scheduled") return jobs.filter((j) => j.status === "scheduled");
    if (tab === "completed") return jobs.filter((j) => j.status === "completed");
    return jobs;
  }, [jobs, tab]);

  function exportJobsCsv() {
    const headers = ["title", "status", "priority", "scheduled_date", "scheduled_time", "customer_contact_phone", "created_at", "completed_at"];
    const rows = [
      headers.join(","),
      ...filtered.map((j) =>
        [j.title, j.status, j.priority, j.scheduled_date || "", j.scheduled_time || "", j.customer_contact_phone || "", j.created_at, j.completed_at || ""]
          .map((v) => `"${String(v).replace(/"/g, '""')}"`)
          .join(",")
      ),
    ];
    const blob = new Blob([rows.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fielddesk-jobs-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    return {
      active: jobs.filter((j) => ["scheduled", "in_progress"].includes(j.status)).length,
      today: jobs.filter((j) => j.scheduled_date === today).length,
      completedThisWeek: jobs.filter((j) => {
        if (!j.completed_at) return false;
        const ageMs = Date.now() - new Date(j.completed_at).getTime();
        return ageMs < 7 * 86_400_000;
      }).length,
    };
  }, [jobs]);

  if (error) {
    return (
      <div className="min-h-screen bg-[#030711] text-foreground">
        <SEOHead title="My FieldDesk — Subscriber Dashboard" description="FieldDesk job board" />
        <DWASuiteNav activeProduct="fielddesk" email={clientEmail || undefined} />
        <div className="max-w-2xl mx-auto px-4 py-24">
          <Card className="bg-[#0a1628] border-red-900">
            <CardContent className="p-8 text-center">
              <AlertCircle className="w-8 h-8 text-red-400 mx-auto mb-3" />
              <p className="text-white font-semibold mb-2">Access denied</p>
              <p className="text-sm text-[#94a3b8]">{error}</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030711] text-foreground">
      <SEOHead title="My FieldDesk — Subscriber Dashboard" description="Job board, status, and tech tracking." />
      <DWASuiteNav activeProduct="fielddesk" email={clientEmail || undefined} />

      <header className="border-b border-[#1e3a5f] bg-[#0a1628]/80 backdrop-blur sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="w-5 h-5 text-[#00d4ff]" />
            <span className="font-bold tracking-tight text-white">My FieldDesk</span>
          </div>
          <a href="tel:+13139921219" className="text-sm text-[#00d4ff] font-semibold">(313) 992-1219</a>
        </div>
      </header>

      <section className="max-w-7xl mx-auto px-3 sm:px-4 py-6 sm:py-8">
        <OnboardingChecklist
          product="FieldDesk"
          steps={[
            { id: "auth", label: "Dashboard link verified", done: !!client, hint: "Open from your welcome email." },
            { id: "jobs", label: "First job created", done: jobs.length > 0, hint: "Add a job from your CRM or via SMS intake." },
            { id: "scheduled", label: "First job scheduled", done: jobs.some((j) => j.scheduled_date), hint: "Assign a date so techs see it on the route." },
            { id: "completed", label: "First job completed", done: jobs.some((j) => j.status === "completed"), hint: "Mark complete to trigger invoicing." },
          ]}
        />
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="bg-gradient-to-br from-[#0a1628] to-[#0a1628]/60 border-[#00d4ff]/40">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-[#00d4ff] mb-1.5 font-bold">Active jobs</p>
              <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{stats.active}</p>
              <p className="text-[11px] text-[#94a3b8] mt-2">Scheduled or in-progress</p>
            </CardContent>
          </Card>
          <Card className="bg-[#0a1628] border-[#1e3a5f]">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] mb-1.5 font-bold">Today</p>
              <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{stats.today}</p>
              <p className="text-[11px] text-[#64748b] mt-2">Scheduled today</p>
            </CardContent>
          </Card>
          <Card className="bg-[#0a1628] border-[#1e3a5f]">
            <CardContent className="p-4">
              <p className="text-[10px] uppercase tracking-widest text-[#94a3b8] mb-1.5 font-bold">Closed (7d)</p>
              <p className="text-3xl sm:text-4xl font-black text-white tabular-nums leading-none">{stats.completedThisWeek}</p>
              <p className="text-[11px] text-[#64748b] mt-2">Completed this week</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex items-center justify-between mb-5 gap-3 flex-wrap">
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="bg-[#0a1628] border border-[#1e3a5f] flex-wrap h-auto">
              {STATUS_TABS.map((t) => (
                <TabsTrigger
                  key={t.value}
                  value={t.value}
                  className="data-[state=active]:bg-[#00d4ff] data-[state=active]:text-black text-[#94a3b8]"
                >
                  {t.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          {filtered.length > 0 && (
            <button
              onClick={exportJobsCsv}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#00d4ff] border border-[#00d4ff]/40 hover:border-[#00d4ff] hover:bg-[#00d4ff]/10 transition-colors rounded-md px-2.5 py-1.5"
            >
              <Download className="w-3 h-3" /> Export CSV
            </button>
          )}
        </div>

        {loading ? (
          <p className="text-[#94a3b8]">Loading jobs…</p>
        ) : filtered.length === 0 ? (
          jobs.length === 0 ? (
            <EmptyDashboardState
              productName="FieldDesk"
              etaText="Once you create your first job from the admin panel or mobile app, it will appear here."
              checklist={[
                "FieldDesk subscription active",
                "Tech accounts ready to invite",
                "Customer records imported",
                "Job board ready to receive jobs",
              ]}
              setupGuideHref="mailto:matt@detroitwebagent.com?subject=FieldDesk%20setup"
            />
          ) : (
            <Card className="bg-[#0a1628] border-[#1e3a5f]">
              <CardContent className="p-8 text-center">
                <Briefcase className="w-8 h-8 text-[#00d4ff] mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">No jobs match this filter</p>
                <p className="text-sm text-[#94a3b8]">Try selecting "All" to see every job.</p>
              </CardContent>
            </Card>
          )
        ) : (
          <div className="grid gap-3">
            {filtered.map((j) => (
              <Card key={j.id} className="bg-[#0a1628] border-[#1e3a5f] hover:border-[#00d4ff]/40 transition">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap mb-1">
                        <Badge variant="outline" className={statusColor(j.status)}>
                          {j.status.replace("_", " ")}
                        </Badge>
                        {j.priority === "urgent" && (
                          <Badge variant="outline" className="bg-red-500/15 text-red-400 border-red-500/30">
                            URGENT
                          </Badge>
                        )}
                      </div>
                      <p className="text-white font-semibold">{j.title}</p>
                      {j.description && (
                        <p className="text-sm text-[#94a3b8] mt-1 line-clamp-2">{j.description}</p>
                      )}
                      <div className="flex items-center gap-4 flex-wrap mt-3 text-xs text-[#94a3b8]">
                        {j.scheduled_date && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {j.scheduled_date}{j.scheduled_time ? ` · ${j.scheduled_time}` : ""}
                          </span>
                        )}
                        {j.assigned_tech_id && (
                          <span className="flex items-center gap-1">
                            <User className="w-3 h-3" />
                            Tech assigned
                          </span>
                        )}
                        {j.customer_contact_phone && (
                          <a href={`tel:${j.customer_contact_phone}`} className="text-[#00d4ff] flex items-center gap-1">
                            <MapPin className="w-3 h-3" /> {j.customer_contact_phone}
                          </a>
                        )}
                      </div>
                    </div>
                    {j.status === "completed" && (
                      <CheckCircle2 className="w-5 h-5 text-green-400 flex-shrink-0" />
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      {clientEmail && (
        <div className="py-6 text-center border-t border-[#1e3a5f]/40">
          <ManageBillingButton email={clientEmail} />
        </div>
      )}
    </div>
  );
}

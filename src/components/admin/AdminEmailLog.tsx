import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle, XCircle, AlertTriangle, Clock, RefreshCw } from "lucide-react";

const TIME_RANGES = [
  { label: "Today", value: "today" },
  { label: "7 Days", value: "7d" },
  { label: "30 Days", value: "30d" },
  { label: "All Time", value: "all" },
];

const getStartDate = (range: string) => {
  const now = new Date();
  if (range === "today") {
    now.setHours(0, 0, 0, 0);
    return now.toISOString();
  }
  if (range === "7d") {
    now.setDate(now.getDate() - 7);
    return now.toISOString();
  }
  if (range === "30d") {
    now.setDate(now.getDate() - 30);
    return now.toISOString();
  }
  return "2020-01-01T00:00:00Z";
};

const statusBadge = (status: string) => {
  switch (status) {
    case "sent":
      return <Badge className="bg-green-600 text-white text-[9px]"><CheckCircle size={10} className="mr-0.5" />Sent</Badge>;
    case "dlq":
    case "failed":
      return <Badge variant="destructive" className="text-[9px]"><XCircle size={10} className="mr-0.5" />Failed</Badge>;
    case "suppressed":
      return <Badge className="bg-yellow-600 text-white text-[9px]"><AlertTriangle size={10} className="mr-0.5" />Suppressed</Badge>;
    case "pending":
      return <Badge variant="secondary" className="text-[9px]"><Clock size={10} className="mr-0.5" />Pending</Badge>;
    default:
      return <Badge variant="outline" className="text-[9px]">{status}</Badge>;
  }
};

const AdminEmailLog = () => {
  const [range, setRange] = useState("today");
  const [templateFilter, setTemplateFilter] = useState<string>("all");

  const startDate = getStartDate(range);

  const { data: emails = [], isLoading, refetch } = useQuery({
    queryKey: ["admin-email-log", range],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_send_log")
        .select("*")
        .gte("created_at", startDate)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;

      const seen = new Map<string, any>();
      for (const row of data || []) {
        const key = row.message_id || row.id;
        if (!seen.has(key)) {
          seen.set(key, row);
        }
      }
      return Array.from(seen.values());
    },
    refetchInterval: 30000,
  });

  const templates = [...new Set(emails.map((e: any) => e.template_name))].sort();
  const filtered = templateFilter === "all" ? emails : emails.filter((e: any) => e.template_name === templateFilter);

  const stats = {
    total: filtered.length,
    sent: filtered.filter((e: any) => e.status === "sent").length,
    failed: filtered.filter((e: any) => e.status === "dlq" || e.status === "failed").length,
    pending: filtered.filter((e: any) => e.status === "pending").length,
    suppressed: filtered.filter((e: any) => e.status === "suppressed").length,
  };

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleString("en-US", {
      month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true,
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        {TIME_RANGES.map((t) => (
          <Button
            key={t.value}
            size="sm"
            variant={range === t.value ? "default" : "outline"}
            onClick={() => setRange(t.value)}
            className="text-[10px] h-7 px-3"
          >
            {t.label}
          </Button>
        ))}
        <select
          className="text-[10px] h-7 px-2 bg-card border border-border rounded text-foreground"
          value={templateFilter}
          onChange={(e) => setTemplateFilter(e.target.value)}
        >
          <option value="all">All Templates</option>
          {templates.map((t: string) => (
            <option key={t} value={t}>{t.replace(/_/g, " ")}</option>
          ))}
        </select>
        <Button size="sm" variant="ghost" onClick={() => refetch()} className="h-7 px-2">
          <RefreshCw size={12} />
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        <Card className="border-border"><CardContent className="p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Total</p>
          <p className="text-xl font-bold text-foreground">{stats.total}</p>
        </CardContent></Card>
        <Card className="border-green-600/30"><CardContent className="p-3 text-center">
          <p className="text-[10px] text-green-400 uppercase">Sent</p>
          <p className="text-xl font-bold text-green-400">{stats.sent}</p>
        </CardContent></Card>
        <Card className="border-destructive/30"><CardContent className="p-3 text-center">
          <p className="text-[10px] text-destructive uppercase">Failed</p>
          <p className="text-xl font-bold text-destructive">{stats.failed}</p>
        </CardContent></Card>
        <Card className="border-yellow-600/30"><CardContent className="p-3 text-center">
          <p className="text-[10px] text-yellow-400 uppercase">Suppressed</p>
          <p className="text-xl font-bold text-yellow-400">{stats.suppressed}</p>
        </CardContent></Card>
        <Card className="border-border"><CardContent className="p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Pending</p>
          <p className="text-xl font-bold text-muted-foreground">{stats.pending}</p>
        </CardContent></Card>
      </div>

      {isLoading ? (
        <p className="text-xs text-muted-foreground text-center py-8">Loading emails...</p>
      ) : filtered.length === 0 ? (
        <Card><CardContent className="p-8 text-center">
          <Mail size={24} className="mx-auto text-muted-foreground mb-2" />
          <p className="text-xs text-muted-foreground">No emails found for this period</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-1.5">
          {filtered.map((email: any) => (
            <Card key={email.id} className="border-border">
              <CardContent className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {statusBadge(email.status)}
                      <span className="text-[10px] text-muted-foreground font-mono">
                        {email.template_name?.replace(/_/g, " ")}
                      </span>
                    </div>
                    <p className="text-xs text-foreground truncate">{email.recipient_email}</p>
                    {email.error_message && (
                      <p className="text-[10px] text-destructive mt-1 truncate">{email.error_message}</p>
                    )}
                  </div>
                  <span className="text-[9px] text-muted-foreground whitespace-nowrap">
                    {formatTime(email.created_at)}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
};

export default AdminEmailLog;

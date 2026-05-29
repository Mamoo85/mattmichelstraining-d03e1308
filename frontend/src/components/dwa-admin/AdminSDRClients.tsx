import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toastSuccess, toastError } from "@/lib/toast";
import {
  Users, Mail, TrendingUp, Activity, Plus, Play,
  Pause, ChevronDown, ChevronUp, ExternalLink, Zap
} from "lucide-react";

interface OutreachClient {
  id: string;
  company_name: string;
  contact_name: string | null;
  contact_email: string | null;
  target_industry: string;
  target_geography: string;
  daily_email_cap: number;
  pitch_headline: string | null;
  cta_url: string | null;
  status: string;
  trial_ends_at: string | null;
  notes: string | null;
  created_at: string;
}

interface DailyStat {
  date: string;
  prospects_found: number;
  enriched: number;
  emails_sent: number;
  emails_opened: number;
  replies: number;
  meetings_booked: number;
}

const STATUS_COLORS: Record<string, string> = {
  active: "bg-green-500/20 text-green-300 border-green-500/30",
  trial:  "bg-blue-500/20 text-blue-300 border-blue-500/30",
  paused: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  cancelled: "bg-red-500/20 text-red-300 border-red-500/30",
};

function ClientCard({ client }: { client: OutreachClient }) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const { data: stats = [] } = useQuery<DailyStat[]>({
    queryKey: ["sdr-stats", client.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("outreach_campaign_stats")
        .select("*")
        .eq("client_id", client.id)
        .order("date", { ascending: false })
        .limit(7);
      return data ?? [];
    },
    staleTime: 60_000,
  });

  const today = stats[0];
  const totalSent = stats.reduce((s, r) => s + r.emails_sent, 0);
  const totalReplies = stats.reduce((s, r) => s + r.replies, 0);

  const runHunter = useMutation({
    mutationFn: async () => {
      const resp = await supabase.functions.invoke("techalert-prospect-hunter", {
        body: { client_id: client.id },
      });
      if (resp.error) throw resp.error;
      return resp.data;
    },
    onSuccess: (data: any) => {
      toastSuccess(`Hunter ran — ${data?.found ?? 0} new prospects found`);
      qc.invalidateQueries({ queryKey: ["sdr-stats", client.id] });
    },
    onError: (e: any) => toastError(`Hunter failed: ${e.message}`),
  });

  const runOutreach = useMutation({
    mutationFn: async () => {
      const resp = await supabase.functions.invoke("techalert-outreach", {
        body: { client_id: client.id },
      });
      if (resp.error) throw resp.error;
      return resp.data;
    },
    onSuccess: (data: any) => {
      toastSuccess(`Outreach sent — ${data?.sent ?? 0} emails`);
      qc.invalidateQueries({ queryKey: ["sdr-stats", client.id] });
    },
    onError: (e: any) => toastError(`Outreach failed: ${e.message}`),
  });

  return (
    <Card className="bg-[#0d1f3c] border border-white/10">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-white text-base">{client.company_name}</CardTitle>
              <Badge className={`text-[10px] border ${STATUS_COLORS[client.status] ?? ""}`}>
                {client.status.toUpperCase()}
              </Badge>
            </div>
            {client.contact_name && (
              <p className="text-white/50 text-xs mt-0.5">{client.contact_name} · {client.contact_email}</p>
            )}
            <p className="text-white/40 text-xs mt-0.5">
              {client.target_industry.toUpperCase()} · {client.target_geography} · {client.daily_email_cap}/day cap
            </p>
          </div>
          <button onClick={() => setExpanded(e => !e)} className="text-white/40 hover:text-white shrink-0 mt-1">
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-4">
        {/* Today's stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: "Found", value: today?.prospects_found ?? 0, icon: <Users className="h-3 w-3" /> },
            { label: "Emailed", value: today?.emails_sent ?? 0, icon: <Mail className="h-3 w-3" /> },
            { label: "Opened", value: today?.emails_opened ?? 0, icon: <Activity className="h-3 w-3" /> },
            { label: "Replied", value: today?.replies ?? 0, icon: <TrendingUp className="h-3 w-3" /> },
          ].map(s => (
            <div key={s.label} className="bg-white/5 rounded-lg p-2 text-center">
              <div className="flex items-center justify-center gap-1 text-white/40 mb-1">{s.icon}<span className="text-[10px]">{s.label}</span></div>
              <div className="text-white font-bold text-lg leading-none">{s.value}</div>
            </div>
          ))}
        </div>

        {/* 7-day totals */}
        <div className="flex gap-4 text-xs text-white/50">
          <span>7-day: <span className="text-white font-medium">{totalSent}</span> sent</span>
          <span><span className="text-green-400 font-medium">{totalReplies}</span> replied</span>
          {totalSent > 0 && (
            <span className="text-[#00d4ff]">{((totalReplies / totalSent) * 100).toFixed(1)}% reply rate</span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10 text-xs h-7"
            onClick={() => runHunter.mutate()}
            disabled={runHunter.isPending}
          >
            <Zap className="h-3 w-3 mr-1" />
            {runHunter.isPending ? "Running…" : "Run Hunter"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="border-white/20 text-white hover:bg-white/10 text-xs h-7"
            onClick={() => runOutreach.mutate()}
            disabled={runOutreach.isPending}
          >
            <Mail className="h-3 w-3 mr-1" />
            {runOutreach.isPending ? "Sending…" : "Send Outreach"}
          </Button>
          <a
            href={`/my-outreach?client_id=${client.id}`}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[10px] text-[#00d4ff] hover:underline ml-auto"
          >
            Client View <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        {/* Expanded: pitch copy + 7-day table */}
        {expanded && (
          <div className="space-y-3 pt-2 border-t border-white/10">
            {client.pitch_headline && (
              <div>
                <p className="text-[10px] text-white/40 uppercase mb-1">Pitch Headline</p>
                <p className="text-white/70 text-xs">{client.pitch_headline}</p>
              </div>
            )}
            {stats.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-white/60">
                  <thead>
                    <tr className="border-b border-white/10">
                      {["Date","Found","Sent","Opened","Replied","Meetings"].map(h => (
                        <th key={h} className="text-left py-1 px-1 text-[10px] text-white/40">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stats.map(row => (
                      <tr key={row.date} className="border-b border-white/5">
                        <td className="py-1 px-1">{row.date}</td>
                        <td className="py-1 px-1">{row.prospects_found}</td>
                        <td className="py-1 px-1">{row.emails_sent}</td>
                        <td className="py-1 px-1">{row.emails_opened}</td>
                        <td className="py-1 px-1 text-green-400">{row.replies}</td>
                        <td className="py-1 px-1 text-[#00d4ff]">{row.meetings_booked}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {client.notes && (
              <p className="text-white/30 text-[10px] italic">{client.notes}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminSDRClients() {
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    company_name: "", contact_name: "", contact_email: "",
    target_industry: "hvac", target_geography: "Metro Detroit",
    daily_email_cap: "50", pitch_headline: "", cta_url: "",
  });
  const qc = useQueryClient();

  const { data: clients = [], isLoading } = useQuery<OutreachClient[]>({
    queryKey: ["sdr-clients"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("outreach_clients")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addClient = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("outreach_clients").insert({
        ...form,
        daily_email_cap: parseInt(form.daily_email_cap) || 50,
        status: "trial",
        trial_ends_at: new Date(Date.now() + 14 * 86400_000).toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toastSuccess("Client added");
      setShowAdd(false);
      setForm({ company_name: "", contact_name: "", contact_email: "", target_industry: "hvac", target_geography: "Metro Detroit", daily_email_cap: "50", pitch_headline: "", cta_url: "" });
      qc.invalidateQueries({ queryKey: ["sdr-clients"] });
    },
    onError: (e: any) => toastError(e.message),
  });

  const active = clients.filter(c => c.status === "active").length;
  const trial  = clients.filter(c => c.status === "trial").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">🤖 Autonomous SDR Clients</h2>
          <p className="text-white/50 text-sm mt-0.5">
            {active} active · {trial} trial · $997/mo per client
          </p>
        </div>
        <Button
          size="sm"
          className="bg-[#00d4ff] hover:bg-[#00bfe8] text-black font-bold text-xs"
          onClick={() => setShowAdd(s => !s)}
        >
          <Plus className="h-3 w-3 mr-1" /> Add Client
        </Button>
      </div>

      {/* MRR summary */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Active MRR", value: `$${(active * 997).toLocaleString()}`, color: "text-green-400" },
          { label: "Trial Pipeline", value: `$${(trial * 997).toLocaleString()}`, color: "text-blue-400" },
          { label: "Total Clients", value: clients.length.toString(), color: "text-white" },
        ].map(m => (
          <div key={m.label} className="bg-[#0d1f3c] border border-white/10 rounded-xl p-4 text-center">
            <div className={`text-2xl font-bold ${m.color}`}>{m.value}</div>
            <div className="text-white/40 text-xs mt-1">{m.label}</div>
          </div>
        ))}
      </div>

      {/* Add client form */}
      {showAdd && (
        <Card className="bg-[#0d1f3c] border border-[#00d4ff]/30">
          <CardHeader><CardTitle className="text-white text-sm">New Client</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              {[
                { key: "company_name", label: "Company Name" },
                { key: "contact_name", label: "Contact Name" },
                { key: "contact_email", label: "Contact Email" },
                { key: "target_industry", label: "Target Industry (hvac / dental / etc)" },
                { key: "target_geography", label: "Geography" },
                { key: "daily_email_cap", label: "Daily Email Cap" },
                { key: "pitch_headline", label: "Pitch Headline" },
                { key: "cta_url", label: "CTA URL" },
              ].map(f => (
                <div key={f.key}>
                  <label className="text-white/50 text-xs mb-1 block">{f.label}</label>
                  <Input
                    className="bg-white/5 border-white/10 text-white text-xs h-8"
                    value={(form as any)[f.key]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  />
                </div>
              ))}
            </div>
            <div className="flex gap-2 pt-2">
              <Button size="sm" className="bg-[#00d4ff] text-black font-bold text-xs" onClick={() => addClient.mutate()} disabled={addClient.isPending || !form.company_name}>
                {addClient.isPending ? "Saving…" : "Save Client"}
              </Button>
              <Button size="sm" variant="ghost" className="text-white/50 text-xs" onClick={() => setShowAdd(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Client cards */}
      {isLoading ? (
        <div className="text-white/40 text-sm">Loading clients…</div>
      ) : clients.length === 0 ? (
        <div className="text-white/40 text-sm text-center py-12">No clients yet. Add the first one above.</div>
      ) : (
        <div className="space-y-4">
          {clients.map(c => <ClientCard key={c.id} client={c} />)}
        </div>
      )}
    </div>
  );
}

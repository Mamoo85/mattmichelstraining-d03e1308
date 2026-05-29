import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Activity, Mail, TrendingUp, Users, Zap, CheckCircle2 } from "lucide-react";

interface Stats {
  date: string;
  prospects_found: number;
  enriched: number;
  emails_sent: number;
  emails_opened: number;
  replies: number;
  meetings_booked: number;
}

interface RecentProspect {
  id: string;
  company_name: string;
  role: string;
  city: string | null;
  outreach_sent_at: string | null;
  replied_at: string | null;
  owner_email: string | null;
  created_at: string;
}

interface Client {
  company_name: string;
  target_industry: string;
  target_geography: string;
  daily_email_cap: number;
  status: string;
}

export default function OutreachClientDashboard() {
  const [params] = useSearchParams();
  const clientId = params.get("client_id") ?? "";

  const { data: client } = useQuery<Client | null>({
    queryKey: ["sdr-client", clientId],
    queryFn: async () => {
      if (!clientId) return null;
      const { data } = await supabase
        .from("outreach_clients")
        .select("company_name,target_industry,target_geography,daily_email_cap,status")
        .eq("id", clientId)
        .single();
      return data;
    },
    enabled: !!clientId,
  });

  const { data: stats = [] } = useQuery<Stats[]>({
    queryKey: ["sdr-stats-client", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("outreach_campaign_stats")
        .select("*")
        .eq("client_id", clientId)
        .order("date", { ascending: false })
        .limit(7);
      return data ?? [];
    },
    enabled: !!clientId,
    refetchInterval: 30_000,
  });

  const { data: recent = [] } = useQuery<RecentProspect[]>({
    queryKey: ["sdr-prospects-client", clientId],
    queryFn: async () => {
      const { data } = await supabase
        .from("techalert_prospect_targets")
        .select("id,company_name,role,city,outreach_sent_at,replied_at,owner_email,created_at")
        .eq("outreach_client_id", clientId)
        .order("created_at", { ascending: false })
        .limit(20);
      return data ?? [];
    },
    enabled: !!clientId,
    refetchInterval: 30_000,
  });

  const today = stats[0];
  const totalSent = stats.reduce((s, r) => s + r.emails_sent, 0);
  const totalReplies = stats.reduce((s, r) => s + r.replies, 0);

  if (!clientId) {
    return (
      <div className="min-h-screen bg-[#050d1a] flex items-center justify-center text-white/50">
        No client ID provided.
      </div>
    );
  }

  const METRICS = [
    { label: "Prospects Found", value: today?.prospects_found ?? 0, icon: <Users className="h-5 w-5" />, color: "text-[#00d4ff]" },
    { label: "Emails Sent", value: today?.emails_sent ?? 0, icon: <Mail className="h-5 w-5" />, color: "text-blue-400" },
    { label: "Opened", value: today?.emails_opened ?? 0, icon: <Activity className="h-5 w-5" />, color: "text-yellow-400" },
    { label: "Replied", value: today?.replies ?? 0, icon: <TrendingUp className="h-5 w-5" />, color: "text-green-400" },
  ];

  return (
    <div className="min-h-screen bg-[#050d1a] text-white font-sans">
      {/* Header */}
      <div className="border-b border-white/10 px-6 py-4 flex items-center justify-between bg-[#0a1628]">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-[#00d4ff]/20 border border-[#00d4ff]/30 flex items-center justify-center">
            <Zap className="h-4 w-4 text-[#00d4ff]" />
          </div>
          <div>
            <h1 className="font-bold text-white text-sm leading-tight">
              {client?.company_name ?? "Your Outreach Machine"}
            </h1>
            <p className="text-white/40 text-xs">
              {client?.target_industry?.toUpperCase()} · {client?.target_geography}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
          <span className="text-green-400 text-xs font-medium">Live</span>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Today's metrics */}
        <div>
          <p className="text-white/40 text-xs uppercase tracking-wide mb-3">Today</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {METRICS.map(m => (
              <div key={m.label} className="bg-[#0d1f3c] border border-white/10 rounded-xl p-4">
                <div className={`${m.color} mb-2`}>{m.icon}</div>
                <div className="text-3xl font-bold text-white">{m.value}</div>
                <div className="text-white/40 text-xs mt-1">{m.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 7-day summary */}
        <div className="bg-[#0d1f3c] border border-white/10 rounded-xl p-5">
          <p className="text-white/40 text-xs uppercase tracking-wide mb-4">7-Day Summary</p>
          <div className="grid grid-cols-3 gap-4 mb-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{totalSent}</div>
              <div className="text-white/40 text-xs">Emails Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-400">{totalReplies}</div>
              <div className="text-white/40 text-xs">Replies</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-[#00d4ff]">
                {totalSent > 0 ? `${((totalReplies / totalSent) * 100).toFixed(1)}%` : "—"}
              </div>
              <div className="text-white/40 text-xs">Reply Rate</div>
            </div>
          </div>
          <div className="space-y-1">
            {stats.map(row => (
              <div key={row.date} className="flex items-center gap-3 text-xs">
                <span className="text-white/30 w-24 shrink-0">{row.date}</span>
                <div className="flex-1 h-1.5 bg-white/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#00d4ff] rounded-full"
                    style={{ width: `${Math.min(100, (row.emails_sent / (client?.daily_email_cap ?? 50)) * 100)}%` }}
                  />
                </div>
                <span className="text-white/50 w-16 text-right shrink-0">{row.emails_sent} sent</span>
                {row.replies > 0 && (
                  <span className="text-green-400 shrink-0">{row.replies} replied</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Live prospect feed */}
        <div>
          <p className="text-white/40 text-xs uppercase tracking-wide mb-3">Live Feed</p>
          {recent.length === 0 ? (
            <div className="bg-[#0d1f3c] border border-white/10 rounded-xl p-8 text-center text-white/30 text-sm">
              Your first prospects will appear here after the 6am hunter run.
            </div>
          ) : (
            <div className="space-y-2">
              {recent.map(p => (
                <div
                  key={p.id}
                  className="bg-[#0d1f3c] border border-white/10 rounded-lg px-4 py-3 flex items-center gap-3"
                >
                  <div className="shrink-0">
                    {p.replied_at ? (
                      <CheckCircle2 className="h-4 w-4 text-green-400" />
                    ) : p.outreach_sent_at ? (
                      <Mail className="h-4 w-4 text-blue-400" />
                    ) : (
                      <span className="h-2 w-2 rounded-full bg-[#00d4ff] inline-block" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium truncate">{p.company_name}</p>
                    <p className="text-white/40 text-xs">
                      {p.role?.replace(/_/g, " ")} · {p.city ?? "Metro Detroit"}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    {p.replied_at ? (
                      <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-[10px]">REPLIED ✓</Badge>
                    ) : p.outreach_sent_at ? (
                      <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-[10px]">EMAILED</Badge>
                    ) : (
                      <Badge className="bg-white/5 text-white/40 border-white/10 text-[10px]">FOUND</Badge>
                    )}
                    <p className="text-white/20 text-[10px] mt-1">
                      {new Date(p.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-white/20 text-xs pb-4">
          Powered by Detroit Web Agency · Updates every 30 seconds
        </p>
      </div>
    </div>
  );
}

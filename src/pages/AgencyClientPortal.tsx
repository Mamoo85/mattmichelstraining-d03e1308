import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  Loader2, Search, ChevronLeft, ChevronRight, Users, Mail, Zap,
  Radio, Lock, MapPin, Phone, ExternalLink, AlertTriangle, TrendingUp
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import RevenueRecoveredLedger from "@/components/RevenueRecoveredLedger";

interface Lead {
  id: string;
  first_name: string | null;
  last_name: string | null;
  company_name: string | null;
  job_title: string | null;
  email: string | null;
  validated_email: boolean | null;
  drip_campaign_status: Record<string, string> | null;
  created_at: string;
}

interface AvailableLead {
  id: string;
  name: string;
  project_type: string | null;
  city: string | null;
  created_at: string;
}

const PAGE_SIZE = 15;

const AgencyClientPortal = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
  const apikey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  // Fetch contractor signals (available leads + FOMO)
  const { data: signalsData } = useQuery({
    queryKey: ["contractor-signals"],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const res = await fetch(`${baseUrl}/get-contractor-signals`, {
        headers: { apikey, Authorization: `Bearer ${session.access_token}` },
      });
      if (!res.ok) return null;
      return res.json();
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!user,
  });

  const availableLeads: AvailableLead[] = signalsData?.available_leads || [];
  const missedCount: number = signalsData?.missed_count || 0;
  const roiToken: string | null = signalsData?.roi_token || null;

  useEffect(() => {
    if (!user) return;
    const fetchLeads = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from("tenant_leads")
        .select("id, first_name, last_name, company_name, job_title, email, validated_email, drip_campaign_status, created_at")
        .order("created_at", { ascending: false });
      if (!error && data) setLeads(data as Lead[]);
      setLoading(false);
    };
    fetchLeads();
  }, [user]);

  const filtered = useMemo(() => {
    if (!search.trim()) return leads;
    const q = search.toLowerCase();
    return leads.filter(
      (l) =>
        l.first_name?.toLowerCase().includes(q) ||
        l.last_name?.toLowerCase().includes(q) ||
        l.company_name?.toLowerCase().includes(q) ||
        l.email?.toLowerCase().includes(q)
    );
  }, [leads, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const totalLeads = leads.length;
  const verifiedEmails = leads.filter((l) => l.validated_email).length;
  const activeDrips = leads.filter((l) => l.drip_campaign_status && Object.keys(l.drip_campaign_status).length > 0).length;

  const getDripBadge = (status: Record<string, string> | null) => {
    if (!status || Object.keys(status).length === 0) return <span className="text-xs text-slate-500">—</span>;
    const latest = Object.entries(status).pop();
    if (!latest) return null;
    return (
      <Badge variant="outline" className="text-[10px] px-2 py-0 border-[#00d4ff]/20 text-[#00d4ff] bg-[#00d4ff]/5">
        {latest[1]}
      </Badge>
    );
  };

  function getTimeAgo(dateStr: string): string {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  }

  return (
    <div className="min-h-screen bg-[#0a1628]">
      <div className="container max-w-5xl mx-auto px-4 pt-8 pb-20">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">Your Leads</h1>
            <p className="text-sm mt-1 text-slate-400">Enriched prospects delivered to your pipeline.</p>
          </div>
          {roiToken && <RevenueRecoveredLedger token={roiToken} clientType="contractor" />}
        </div>

        {/* High-Intent Radar */}
        {(availableLeads.length > 0 || missedCount >= 3) && (
          <div className="space-y-3 mb-8">
            <div className="flex items-center gap-2">
              <Radio className="h-4 w-4 text-[#00d4ff] animate-pulse" />
              <h2 className="text-white font-bold text-sm uppercase tracking-wider">Live Leads — Last 24h</h2>
              <span className="text-[10px] text-slate-500 ml-auto">{availableLeads.length} available</span>
            </div>

            {availableLeads.length > 0 && (
              <div className="grid gap-3 md:grid-cols-2">
                {availableLeads.map((lead) => (
                  <Card key={lead.id} className="border-[#00d4ff]/20 bg-gradient-to-br from-[#0a1628] to-[#0d1f2e]">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <p className="text-white font-bold text-sm">{lead.name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            {lead.project_type && (
                              <Badge variant="outline" className="text-[10px] px-2 py-0 border-[#00d4ff]/20 text-[#00d4ff]">
                                {lead.project_type}
                              </Badge>
                            )}
                            {lead.city && (
                              <span className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                <MapPin className="h-2.5 w-2.5" /> {lead.city}
                              </span>
                            )}
                          </div>
                        </div>
                        <span className="text-[10px] text-[#00d4ff] font-bold shrink-0">{getTimeAgo(lead.created_at)}</span>
                      </div>
                      <Button
                        size="sm"
                        className="w-full mt-2 h-8 text-[11px] bg-[#00d4ff] hover:bg-[#00d4ff]/90 text-black font-bold"
                        asChild
                      >
                        <a href={`/contractor-leads?claim=${lead.id}`}>
                          <Zap className="h-3 w-3 mr-1" /> ⚡ Claim This Lead
                        </a>
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}

            {/* FOMO Card */}
            {missedCount >= 3 && (
              <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 flex items-start gap-3">
                <Lock className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-white font-bold text-sm">
                    {missedCount} leads locked by competitors this week
                  </p>
                  <p className="text-amber-300/70 text-xs mt-1">
                    Upgrade to Territory Lock and never lose a lead in your area again.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3 h-8 text-[11px] bg-amber-500 hover:bg-amber-600 text-black font-bold"
                    asChild
                  >
                    <a href="/contractor-leads">
                      <Lock className="h-3 w-3 mr-1" /> Upgrade to Territory Lock — $399/mo
                    </a>
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* KPI Strip */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { icon: Users, label: "Total Leads", value: totalLeads },
            { icon: Mail, label: "Verified Emails", value: verifiedEmails },
            { icon: Zap, label: "Active Drips", value: activeDrips },
          ].map(({ icon: Icon, label, value }) => (
            <Card key={label} className="border-white/5 bg-gradient-to-br from-[#0a1628] to-[#0d1f2e]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className="h-4 w-4 text-[#00d4ff]" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span>
                </div>
                <span className="text-2xl font-black text-white">{value}</span>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Search */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" />
          <Input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search leads..."
            className="pl-10 border-white/5 bg-white/5 text-slate-200 placeholder:text-slate-500"
          />
        </div>

        {/* Lead Table */}
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-[#00d4ff]" />
          </div>
        ) : paged.length === 0 ? (
          <Card className="border-white/5 bg-gradient-to-br from-[#0a1628] to-[#0d1f2e]">
            <CardContent className="p-12 text-center">
              <p className="text-lg font-semibold text-white">No leads yet</p>
              <p className="text-sm mt-1 text-slate-400">We're working on enriching your pipeline. Check back soon.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="rounded-xl overflow-hidden border border-white/5 bg-gradient-to-br from-[#0a1628] to-[#0d1f2e]">
            <div className="grid grid-cols-5 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em] text-slate-500 border-b border-white/5">
              <span>Name</span><span>Company</span><span>Title</span><span>Email</span><span className="text-right">Drip Status</span>
            </div>
            {paged.map((lead) => (
              <div key={lead.id} className="grid grid-cols-5 items-center px-5 py-3 hover:bg-white/[0.02] transition-colors border-b border-white/[0.03]">
                <span className="text-sm font-medium truncate text-white">
                  {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—"}
                </span>
                <span className="text-sm truncate text-slate-400">{lead.company_name || "—"}</span>
                <span className="text-sm truncate text-slate-400">{lead.job_title || "—"}</span>
                <span className={`text-sm truncate ${lead.validated_email ? "text-emerald-400" : "text-slate-400"}`}>{lead.email || "—"}</span>
                <div className="text-right">{getDripBadge(lead.drip_campaign_status as Record<string, string> | null)}</div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-1">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              className="p-2 rounded-lg disabled:opacity-30 text-slate-400"><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-xs text-slate-500">Page {page + 1} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="p-2 rounded-lg disabled:opacity-30 text-slate-400"><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgencyClientPortal;

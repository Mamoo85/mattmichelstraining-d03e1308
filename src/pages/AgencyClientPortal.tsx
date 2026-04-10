import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Loader2, Search, ChevronLeft, ChevronRight, Users, Mail, Zap } from "lucide-react";
import { Input } from "@/components/ui/input";

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

const PAGE_SIZE = 15;

const AgencyClientPortal = () => {
  const { user } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  useEffect(() => {
    if (!user) return;
    const fetchLeads = async () => {
      setLoading(true);
      // RLS ensures only this tenant's leads are returned
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
    if (!status || Object.keys(status).length === 0) return <span className="text-xs" style={{ color: "#475569" }}>—</span>;
    const latest = Object.entries(status).pop();
    if (!latest) return null;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider animate-shimmer-badge"
        style={{ background: "rgba(34,211,238,0.12)", color: "#22d3ee", border: "1px solid rgba(34,211,238,0.2)" }}>
        {latest[1]}
      </span>
    );
  };

  return (
    <div className="min-h-screen" style={{ background: "#0a0a0a" }}>
      <div className="container max-w-5xl mx-auto px-4 pt-16 pb-20">
        <div className="mb-8">
          <h1 className="text-2xl md:text-3xl font-black tracking-tight" style={{ color: "#f8fafc" }}>Your Leads</h1>
          <p className="text-sm mt-1" style={{ color: "#64748b" }}>Enriched prospects delivered to your pipeline.</p>
        </div>

        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { icon: Users, label: "Total Leads", value: totalLeads },
            { icon: Mail, label: "Verified Emails", value: verifiedEmails },
            { icon: Zap, label: "Active Drips", value: activeDrips },
          ].map(({ icon: Icon, label, value }) => (
            <div key={label} className="rounded-xl p-4" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid #1e1e24" }}>
              <div className="flex items-center gap-2 mb-1">
                <Icon className="h-4 w-4" style={{ color: "#22d3ee" }} />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: "#64748b" }}>{label}</span>
              </div>
              <span className="text-2xl font-black" style={{ color: "#f8fafc" }}>{value}</span>
            </div>
          ))}
        </div>

        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4" style={{ color: "#475569" }} />
          <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            placeholder="Search leads..." className="pl-10 border-0 text-sm"
            style={{ background: "rgba(15,23,42,0.6)", color: "#e2e8f0" }} />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin" style={{ color: "#22d3ee" }} />
          </div>
        ) : paged.length === 0 ? (
          <div className="rounded-xl p-12 text-center" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid #1e1e24" }}>
            <p className="text-lg font-semibold" style={{ color: "#e2e8f0" }}>No leads yet</p>
            <p className="text-sm mt-1" style={{ color: "#64748b" }}>We're working on enriching your pipeline. Check back soon.</p>
          </div>
        ) : (
          <div className="rounded-xl overflow-hidden" style={{ background: "rgba(15,23,42,0.6)", border: "1px solid #1e1e24" }}>
            <div className="grid grid-cols-5 px-5 py-3 text-[10px] font-bold uppercase tracking-[0.15em]"
              style={{ color: "#475569", borderBottom: "1px solid rgba(148,163,184,0.06)" }}>
              <span>Name</span><span>Company</span><span>Title</span><span>Email</span><span className="text-right">Drip Status</span>
            </div>
            {paged.map((lead) => (
              <div key={lead.id} className="grid grid-cols-5 items-center px-5 py-3 hover:bg-white/[0.02] transition-colors"
                style={{ borderBottom: "1px solid rgba(148,163,184,0.04)" }}>
                <span className="text-sm font-medium truncate" style={{ color: "#e2e8f0" }}>
                  {[lead.first_name, lead.last_name].filter(Boolean).join(" ") || "—"}
                </span>
                <span className="text-sm truncate" style={{ color: "#94a3b8" }}>{lead.company_name || "—"}</span>
                <span className="text-sm truncate" style={{ color: "#94a3b8" }}>{lead.job_title || "—"}</span>
                <span className="text-sm truncate" style={{ color: lead.validated_email ? "#22c55e" : "#94a3b8" }}>{lead.email || "—"}</span>
                <div className="text-right">{getDripBadge(lead.drip_campaign_status as Record<string, string> | null)}</div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4 px-1">
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0}
              className="p-2 rounded-lg disabled:opacity-30" style={{ color: "#94a3b8" }}><ChevronLeft className="h-4 w-4" /></button>
            <span className="text-xs" style={{ color: "#64748b" }}>Page {page + 1} of {totalPages}</span>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
              className="p-2 rounded-lg disabled:opacity-30" style={{ color: "#94a3b8" }}><ChevronRight className="h-4 w-4" /></button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AgencyClientPortal;

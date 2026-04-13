import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Eye, Building2, MapPin, Clock, TrendingUp, Zap,
  Globe, AlertCircle, Users, BarChart3, ExternalLink,
  X, Sparkles, Mail, Phone, User, ArrowRight, Loader2,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

// ── Types ──────────────────────────────────────────────────────────────────────

interface VisitorEvent {
  id: string;
  client_id: string;
  company_name: string | null;
  org: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  ip_address: string | null;
  is_business: boolean;
  page_visited: string | null;
  referrer: string | null;
  visit_count: number;
  lead_auto_created: boolean;
  pipeline_lead_id: string | null;
  created_at: string;
  last_seen_at: string;
  enrichment_data: any;
  field_crm_clients?: { business_name: string };
}

interface ClientRow {
  id: string;
  business_name: string;
  visitor_script_key: string;
}

interface EnrichResult {
  success: boolean;
  owner_name?: string;
  owner_email?: string;
  owner_phone?: string;
  website?: string;
  confidence?: string;
  emails_found?: string[];
  phones_found?: string[];
  error?: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

function pageLabel(page: string | null): string {
  if (!page) return "Homepage";
  try {
    const u = new URL(page);
    const path = u.pathname.replace(/\/$/, "") || "/";
    return path === "/" ? "Homepage" : path.replace(/^\//, "").replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  } catch {
    return page;
  }
}

// ── Script Snippet Modal ───────────────────────────────────────────────────────

const SnippetModal = ({ client, onClose }: { client: ClientRow; onClose: () => void }) => {
  const [copied, setCopied] = useState(false);
  const snippet = `<!-- M² Visitor Intel by Detroit Web Agency -->
<script>
(function(){
  var d={page:window.location.href,ref:document.referrer,key:"${client.visitor_script_key}"};
  fetch("${import.meta.env.VITE_SUPABASE_URL}/functions/v1/visitor-identify",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({script_key:d.key,page:d.page,referrer:d.ref})
  });
})();
</script>`;

  const copy = () => {
    navigator.clipboard.writeText(snippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-bold text-lg">Install on {client.business_name}'s site</h3>
          <button onClick={onClose} className="text-white/40 hover:text-white text-xl">✕</button>
        </div>
        <p className="text-white/60 text-sm mb-4">
          Paste this snippet before the <code className="text-orange-400">&lt;/body&gt;</code> tag. Works on WordPress, Squarespace, Wix — any site. Takes 2 minutes.
        </p>
        <pre className="bg-black/60 rounded-xl p-4 text-xs text-green-400 overflow-x-auto whitespace-pre-wrap mb-4 font-mono">
          {snippet}
        </pre>
        <div className="flex gap-3">
          <Button onClick={copy} className="bg-orange-500 hover:bg-orange-600 text-white flex-1">
            {copied ? "✓ Copied!" : "Copy Snippet"}
          </Button>
          <Button variant="outline" onClick={onClose} className="border-white/20 text-white/70">
            Done
          </Button>
        </div>
      </div>
    </div>
  );
};

// ── Visitor Detail Panel ──────────────────────────────────────────────────────

const VisitorDetailPanel = ({ visitor, onClose }: { visitor: VisitorEvent; onClose: () => void }) => {
  const [enriching, setEnriching] = useState(false);
  const [enrichResult, setEnrichResult] = useState<EnrichResult | null>(null);
  const { toast } = useToast();

  // Check if already enriched
  const existingEnrichment = visitor.enrichment_data?.owner_name ? visitor.enrichment_data : null;

  const handleEnrich = async () => {
    if (!visitor.company_name) return;
    setEnriching(true);
    try {
      const { data, error } = await supabase.functions.invoke("enrich-visitor", {
        body: {
          company_name: visitor.company_name,
          city: visitor.city || "",
          visitor_event_id: visitor.id,
        },
      });
      if (error) throw error;
      setEnrichResult(data);
      toast({
        title: data?.owner_email ? "✅ Contact found!" : "Partial results",
        description: data?.owner_name ? `Found: ${data.owner_name}` : "Check results below",
      });
    } catch (err: any) {
      toast({ title: "Enrichment failed", description: err.message, variant: "destructive" });
    } finally {
      setEnriching(false);
    }
  };

  const enrichData = enrichResult || existingEnrichment;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex justify-end" onClick={onClose}>
      <motion.div
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", damping: 25, stiffness: 200 }}
        className="w-full max-w-md bg-[#0f172a] border-l border-white/10 h-full overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6 space-y-6">
          {/* Header */}
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-white font-black text-lg">
                {visitor.company_name || "Anonymous Visitor"}
              </h3>
              {visitor.org && visitor.org !== visitor.company_name && (
                <p className="text-white/40 text-xs mt-0.5">{visitor.org}</p>
              )}
            </div>
            <button onClick={onClose} className="text-white/40 hover:text-white p-1">
              <X size={18} />
            </button>
          </div>

          {/* Status badges */}
          <div className="flex flex-wrap gap-2">
            {visitor.is_business && (
              <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Business</Badge>
            )}
            {visitor.lead_auto_created && (
              <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30">Lead Created</Badge>
            )}
            <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">{visitor.visit_count} visit{visitor.visit_count !== 1 ? "s" : ""}</Badge>
          </div>

          {/* Location & Visit Info */}
          <div className="rounded-xl border border-white/10 bg-white/3 p-4 space-y-3">
            <h4 className="text-white/70 text-xs font-semibold uppercase tracking-wider">Visit Details</h4>
            <div className="space-y-2 text-sm">
              {(visitor.city || visitor.region) && (
                <div className="flex items-center gap-2 text-white/60">
                  <MapPin size={14} className="text-orange-400 shrink-0" />
                  <span>{[visitor.city, visitor.region, visitor.country].filter(Boolean).join(", ")}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-white/60">
                <Globe size={14} className="text-blue-400 shrink-0" />
                <span>{pageLabel(visitor.page_visited)}</span>
              </div>
              {visitor.referrer && (
                <div className="flex items-center gap-2 text-white/60">
                  <ArrowRight size={14} className="text-purple-400 shrink-0" />
                  <span className="truncate">From: {visitor.referrer}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-white/60">
                <Clock size={14} className="text-white/40 shrink-0" />
                <span>First seen: {new Date(visitor.created_at).toLocaleDateString()}</span>
              </div>
              <div className="flex items-center gap-2 text-white/60">
                <Clock size={14} className="text-white/40 shrink-0" />
                <span>Last seen: {timeAgo(visitor.last_seen_at)}</span>
              </div>
            </div>
          </div>

          {/* Pipeline link */}
          {visitor.pipeline_lead_id && (
            <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Zap size={14} className="text-orange-400" />
                <span className="text-orange-400 text-sm font-bold">Lead in Pipeline</span>
              </div>
              <p className="text-white/50 text-xs">This visitor was auto-added to your prospect pipeline.</p>
              <Button
                size="sm"
                className="mt-2 bg-orange-500/20 text-orange-400 hover:bg-orange-500/30 border border-orange-500/30"
                onClick={() => window.open(`/admin?tab=dwa&sub=prospector`, "_blank")}
              >
                View in Pipeline →
              </Button>
            </div>
          )}

          {/* 1-Click Enrich */}
          {visitor.is_business && visitor.company_name && (
            <div className="rounded-xl border border-cyan-500/30 bg-cyan-500/5 p-4">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles size={14} className="text-cyan-400" />
                <span className="text-cyan-400 text-sm font-bold">1-Click Enrich</span>
              </div>
              <p className="text-white/50 text-xs mb-3">
                Find the owner's name, email, and phone from their company website.
              </p>

              {!enrichData ? (
                <Button
                  onClick={handleEnrich}
                  disabled={enriching}
                  className="w-full bg-cyan-500/20 text-cyan-400 hover:bg-cyan-500/30 border border-cyan-500/30"
                >
                  {enriching ? (
                    <><Loader2 size={14} className="animate-spin mr-2" /> Enriching...</>
                  ) : (
                    <><Sparkles size={14} className="mr-2" /> Enrich {visitor.company_name}</>
                  )}
                </Button>
              ) : (
                <div className="space-y-2 mt-2">
                  {enrichData.owner_name && (
                    <div className="flex items-center gap-2 text-white/80 text-sm">
                      <User size={14} className="text-cyan-400 shrink-0" />
                      <span className="font-semibold">{enrichData.owner_name}</span>
                    </div>
                  )}
                  {enrichData.owner_email && (
                    <div className="flex items-center gap-2 text-white/80 text-sm">
                      <Mail size={14} className="text-cyan-400 shrink-0" />
                      <a href={`mailto:${enrichData.owner_email}`} className="underline hover:text-cyan-400">{enrichData.owner_email}</a>
                    </div>
                  )}
                  {enrichData.owner_phone && (
                    <div className="flex items-center gap-2 text-white/80 text-sm">
                      <Phone size={14} className="text-cyan-400 shrink-0" />
                      <a href={`tel:${enrichData.owner_phone}`} className="underline hover:text-cyan-400">{enrichData.owner_phone}</a>
                    </div>
                  )}
                  {enrichData.website && (
                    <div className="flex items-center gap-2 text-white/80 text-sm">
                      <Globe size={14} className="text-cyan-400 shrink-0" />
                      <a href={enrichData.website} target="_blank" rel="noopener" className="underline hover:text-cyan-400 truncate">{enrichData.website}</a>
                    </div>
                  )}
                  {enrichData.confidence && (
                    <Badge className={`text-[10px] ${
                      enrichData.confidence === "high" ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" :
                      enrichData.confidence === "medium" ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" :
                      "bg-red-500/20 text-red-400 border-red-500/30"
                    }`}>
                      {enrichData.confidence} confidence
                    </Badge>
                  )}
                  {!enrichData.owner_email && !enrichData.owner_phone && (
                    <p className="text-white/30 text-xs">No contact info found. Try searching manually.</p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Client label */}
          {visitor.field_crm_clients?.business_name && (
            <div className="text-xs text-white/30 pt-2 border-t border-white/5">
              Tracked on: {visitor.field_crm_clients.business_name}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};

// ── Stat Card ─────────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType; label: string; value: string | number; sub?: string; color: string;
}) => (
  <div className="rounded-2xl border p-4" style={{ background: `${color}10`, borderColor: `${color}25` }}>
    <div className="flex items-start justify-between mb-2">
      <Icon size={18} style={{ color }} />
    </div>
    <div className="text-2xl font-black text-white">{value}</div>
    <div className="text-xs font-semibold mt-0.5" style={{ color }}>{label}</div>
    {sub && <div className="text-xs text-white/40 mt-0.5">{sub}</div>}
  </div>
);

// ── Visitor Row ────────────────────────────────────────────────────────────────

const VisitorRow = ({ v, isNew, onClick }: { v: VisitorEvent; isNew: boolean; onClick: () => void }) => (
  <motion.div
    layout
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 20 }}
    onClick={onClick}
    className={`flex items-start gap-3 p-3 rounded-xl border transition-all cursor-pointer hover:bg-white/6 ${
      isNew ? "border-orange-500/40 bg-orange-500/8" : v.is_business ? "border-white/10 bg-white/4" : "border-white/5 bg-white/2"
    }`}
  >
    <div className="mt-1 shrink-0">
      {v.is_business ? (
        <div className={`w-2.5 h-2.5 rounded-full ${isNew ? "bg-orange-400 animate-pulse" : "bg-emerald-400"}`} />
      ) : (
        <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
      )}
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        {v.company_name ? (
          <span className="text-white font-bold text-sm">{v.company_name}</span>
        ) : (
          <span className="text-white/40 text-sm italic">Anonymous visitor</span>
        )}
        {v.is_business && (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px] py-0">Business</Badge>
        )}
        {v.lead_auto_created && (
          <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-[10px] py-0">Lead Created</Badge>
        )}
        {v.visit_count > 1 && (
          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-[10px] py-0">{v.visit_count} visits</Badge>
        )}
      </div>
      <div className="flex items-center gap-3 mt-1 text-xs text-white/40 flex-wrap">
        {(v.city || v.region) && (
          <span className="flex items-center gap-1">
            <MapPin size={10} />
            {[v.city, v.region].filter(Boolean).join(", ")}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Globe size={10} />
          {pageLabel(v.page_visited)}
        </span>
        <span className="flex items-center gap-1">
          <Clock size={10} />
          {timeAgo(v.last_seen_at)}
        </span>
      </div>
    </div>
    {v.field_crm_clients?.business_name && (
      <div className="text-[10px] text-white/30 shrink-0">{v.field_crm_clients.business_name}</div>
    )}
  </motion.div>
);

// ── Main Component ─────────────────────────────────────────────────────────────

export default function VisitorIntelFeed() {
  const [visitors, setVisitors] = useState<VisitorEvent[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [snippetClient, setSnippetClient] = useState<ClientRow | null>(null);
  const [selectedVisitor, setSelectedVisitor] = useState<VisitorEvent | null>(null);
  const [loading, setLoading] = useState(true);

  const todayVisitors = visitors.filter((v) => {
    const d = new Date(v.created_at);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
  });
  const businessVisitors = visitors.filter((v) => v.is_business);
  const leadsCreated = visitors.filter((v) => v.lead_auto_created);
  const uniqueCompanies = new Set(visitors.filter((v) => v.company_name).map((v) => v.company_name)).size;

  useEffect(() => {
    supabase.from("field_crm_clients").select("id, business_name, visitor_script_key").eq("status", "active")
      .then(({ data }) => setClients(data || []));

    supabase
      .from("crm_visitor_events")
      .select("*, field_crm_clients(business_name)")
      .order("last_seen_at", { ascending: false })
      .limit(100)
      .then(({ data }) => { setVisitors((data as VisitorEvent[]) || []); setLoading(false); });

    const channel = supabase
      .channel("visitor_intel_feed")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "crm_visitor_events" },
        (payload) => {
          const v = payload.new as VisitorEvent;
          setVisitors((prev) => [v, ...prev.slice(0, 99)]);
          setNewIds((prev) => new Set([...prev, v.id]));
          setTimeout(() => setNewIds((prev) => { const next = new Set(prev); next.delete(v.id); return next; }), 5000);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <Eye size={32} className="text-orange-400 mx-auto mb-3 animate-pulse" />
          <p className="text-white/40 text-sm">Loading visitor intelligence...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {snippetClient && <SnippetModal client={snippetClient} onClose={() => setSnippetClient(null)} />}
      <AnimatePresence>
        {selectedVisitor && <VisitorDetailPanel visitor={selectedVisitor} onClose={() => setSelectedVisitor(null)} />}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-white text-xl font-black flex items-center gap-2">
            <Eye size={20} className="text-orange-400" />
            Visitor Intelligence
          </h2>
          <p className="text-white/40 text-sm mt-0.5">
            See who's on your clients' websites — click any row for details + enrichment.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
          <span className="text-emerald-400 text-xs font-semibold">Live</span>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Eye} label="Today's Visitors" value={todayVisitors.length} sub="last 24h" color="#f97316" />
        <StatCard icon={Building2} label="Businesses ID'd" value={businessVisitors.length} sub="confirmed companies" color="#10b981" />
        <StatCard icon={Users} label="Unique Companies" value={uniqueCompanies} sub="all time" color="#3b82f6" />
        <StatCard icon={Zap} label="Leads Auto-Created" value={leadsCreated.length} sub="pushed to pipeline" color="#a855f7" />
      </div>

      {/* Client script keys */}
      {clients.length > 0 && (
        <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
          <div className="flex items-center gap-2 mb-3">
            <Globe size={14} className="text-orange-400" />
            <span className="text-white text-sm font-bold">Install Tracking Snippets</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {clients.map((c) => (
              <button
                key={c.id}
                onClick={() => setSnippetClient(c)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-orange-500/15 border border-white/10 hover:border-orange-500/40 text-white/70 hover:text-white text-xs transition-all"
              >
                <ExternalLink size={10} />
                {c.business_name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Feed + right panel */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-2">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-orange-400" />
            <span className="text-white/70 text-xs font-semibold uppercase tracking-wider">Live Visitor Feed</span>
          </div>
          {visitors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-12 text-center">
              <AlertCircle size={32} className="text-white/20 mx-auto mb-3" />
              <p className="text-white/40 text-sm">No visitors yet.</p>
              <p className="text-white/25 text-xs mt-1">Install a snippet on a client's website to start tracking.</p>
            </div>
          ) : (
            <AnimatePresence initial={false}>
              {visitors.map((v) => (
                <VisitorRow key={v.id} v={v} isNew={newIds.has(v.id)} onClick={() => setSelectedVisitor(v)} />
              ))}
            </AnimatePresence>
          )}
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
            <div className="flex items-center gap-2 mb-3">
              <Building2 size={13} className="text-emerald-400" />
              <span className="text-white/70 text-xs font-semibold uppercase tracking-wider">Top Companies</span>
            </div>
            {businessVisitors.length === 0 ? (
              <p className="text-white/30 text-xs">No businesses identified yet.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(
                  businessVisitors.reduce<Record<string, number>>((acc, v) => {
                    const name = v.company_name || "Unknown";
                    acc[name] = (acc[name] || 0) + v.visit_count;
                    return acc;
                  }, {})
                )
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 8)
                  .map(([name, count]) => (
                    <div key={name} className="flex items-center justify-between gap-2 cursor-pointer hover:bg-white/5 rounded px-1 py-0.5 -mx-1"
                      onClick={() => {
                        const match = visitors.find(v => v.company_name === name);
                        if (match) setSelectedVisitor(match);
                      }}
                    >
                      <span className="text-white/80 text-xs truncate">{name}</span>
                      <span className="text-white/40 text-xs shrink-0">{count} visit{count !== 1 ? "s" : ""}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/3 p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 size={13} className="text-blue-400" />
              <span className="text-white/70 text-xs font-semibold uppercase tracking-wider">Hot Pages</span>
            </div>
            {visitors.length === 0 ? (
              <p className="text-white/30 text-xs">No page data yet.</p>
            ) : (
              <div className="space-y-2">
                {Object.entries(
                  visitors.reduce<Record<string, number>>((acc, v) => {
                    const pg = pageLabel(v.page_visited);
                    acc[pg] = (acc[pg] || 0) + 1;
                    return acc;
                  }, {})
                )
                  .sort(([, a], [, b]) => b - a)
                  .slice(0, 6)
                  .map(([pg, count]) => (
                    <div key={pg} className="flex items-center justify-between gap-2">
                      <span className="text-white/80 text-xs truncate">{pg}</span>
                      <span className="text-white/40 text-xs shrink-0">{count}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

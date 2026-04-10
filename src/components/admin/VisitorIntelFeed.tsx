import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Eye, Building2, MapPin, Clock, TrendingUp, Zap,
  Globe, AlertCircle, Users, BarChart3, ExternalLink,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface VisitorEvent {
  id: string;
  client_id: string;
  company_name: string | null;
  org: string | null;
  city: string | null;
  region: string | null;
  is_business: boolean;
  page_visited: string | null;
  visit_count: number;
  lead_auto_created: boolean;
  created_at: string;
  last_seen_at: string;
  field_crm_clients?: { business_name: string };
}

interface ClientRow {
  id: string;
  business_name: string;
  visitor_script_key: string;
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

const VisitorRow = ({ v, isNew }: { v: VisitorEvent; isNew: boolean }) => (
  <motion.div
    layout
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    exit={{ opacity: 0, x: 20 }}
    className={`flex items-start gap-3 p-3 rounded-xl border transition-all ${
      isNew ? "border-orange-500/40 bg-orange-500/8" : v.is_business ? "border-white/10 bg-white/4" : "border-white/5 bg-white/2"
    }`}
  >
    {/* Status dot */}
    <div className="mt-1 shrink-0">
      {v.is_business ? (
        <div className={`w-2.5 h-2.5 rounded-full ${isNew ? "bg-orange-400 animate-pulse" : "bg-emerald-400"}`} />
      ) : (
        <div className="w-2.5 h-2.5 rounded-full bg-white/20" />
      )}
    </div>

    {/* Main info */}
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

    {/* Client label */}
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
  const [loading, setLoading] = useState(true);

  // Stats
  const todayVisitors = visitors.filter((v) => {
    const d = new Date(v.created_at);
    const now = new Date();
    return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
  });
  const businessVisitors = visitors.filter((v) => v.is_business);
  const leadsCreated = visitors.filter((v) => v.lead_auto_created);
  const uniqueCompanies = new Set(visitors.filter((v) => v.company_name).map((v) => v.company_name)).size;

  useEffect(() => {
    // Load clients for snippet modal
    supabase.from("field_crm_clients").select("id, business_name, visitor_script_key").eq("status", "active")
      .then(({ data }) => setClients(data || []));

    // Load recent visitors
    supabase
      .from("crm_visitor_events")
      .select("*, field_crm_clients(business_name)")
      .order("last_seen_at", { ascending: false })
      .limit(100)
      .then(({ data }) => { setVisitors((data as VisitorEvent[]) || []); setLoading(false); });

    // Real-time subscription — new visitors appear instantly
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

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-white text-xl font-black flex items-center gap-2">
            <Eye size={20} className="text-orange-400" />
            Visitor Intelligence
          </h2>
          <p className="text-white/40 text-sm mt-0.5">
            See who's on your clients' websites — before they ever call.
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
        {/* Live feed */}
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
                <VisitorRow key={v.id} v={v} isNew={newIds.has(v.id)} />
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Right: Top pages + Top companies */}
        <div className="space-y-4">
          {/* Top companies */}
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
                    <div key={name} className="flex items-center justify-between gap-2">
                      <span className="text-white/80 text-xs truncate">{name}</span>
                      <span className="text-white/40 text-xs shrink-0">{count} visit{count !== 1 ? "s" : ""}</span>
                    </div>
                  ))}
              </div>
            )}
          </div>

          {/* Top pages */}
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

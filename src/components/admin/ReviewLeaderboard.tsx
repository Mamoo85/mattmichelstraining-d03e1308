import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  Star, Send, Trophy, TrendingUp, CheckCircle, MousePointerClick,
  MessageSquare, Plus, RefreshCw, Phone,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ReviewLog {
  id: string;
  client_id: string;
  customer_name: string | null;
  customer_phone: string;
  job_description: string | null;
  tech_name: string | null;
  sent_at: string;
  clicked_at: string | null;
  reviewed_at: string | null;
  status: string;
}

interface ClientRow { id: string; business_name: string; google_review_url: string | null }

interface TechStat {
  name: string;
  sent: number;
  clicked: number;
  reviewed: number;
  rate: number;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const MEDAL = ["🥇", "🥈", "🥉"];

// ── Send Blast Modal ───────────────────────────────────────────────────────────

const SendBlastModal = ({ clients, onClose, onSent }: {
  clients: ClientRow[]; onClose: () => void; onSent: () => void;
}) => {
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [techName, setTechName] = useState("");
  const [jobDesc, setJobDesc] = useState("");
  const [sending, setSending] = useState(false);

  const selectedClient = clients.find((c) => c.id === clientId);

  const send = async () => {
    if (!customerPhone.trim() || !clientId) return;
    setSending(true);

    // Log the review blast (actual SMS would be sent by edge function)
    const { error } = await supabase.from("review_blast_log").insert({
      client_id: clientId,
      customer_name: customerName || null,
      customer_phone: customerPhone.trim(),
      job_description: jobDesc || null,
      tech_name: techName || null,
      status: "sent",
    });

    if (error) { toast.error("Failed to log review blast"); setSending(false); return; }

    // TODO: Wire to review-blast-sender edge function when Twilio is active
    toast.success(`Review request logged for ${customerName || customerPhone}`);
    setSending(false);
    onSent();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-bold text-lg mb-1">Send Review Request</h3>
        <p className="text-white/40 text-sm mb-4">
          Texts the customer a direct Google review link after their job.
        </p>

        {selectedClient?.google_review_url ? (
          <div className="mb-4 px-3 py-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
            ✓ Google review link configured for {selectedClient.business_name}
          </div>
        ) : (
          <div className="mb-4 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs">
            ⚠ No Google review URL set for this client yet. Add it in client settings.
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-white/60 text-xs mb-1 block">Client Company</label>
            <Select value={clientId} onValueChange={setClientId}>
              <SelectTrigger className="bg-white/5 border-white/10 text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[#1e293b] border-white/10">
                {clients.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="text-white">{c.business_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/60 text-xs mb-1 block">Customer Name</label>
              <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="John Smith"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1 block">Customer Phone *</label>
              <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="(313) 555-0100"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-white/60 text-xs mb-1 block">Tech Name</label>
              <Input value={techName} onChange={(e) => setTechName(e.target.value)} placeholder="Mike J."
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            </div>
            <div>
              <label className="text-white/60 text-xs mb-1 block">Job Summary</label>
              <Input value={jobDesc} onChange={(e) => setJobDesc(e.target.value)} placeholder="Boiler repair"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <Button onClick={send} disabled={sending || !customerPhone.trim()} className="bg-orange-500 hover:bg-orange-600 flex-1">
            <Send size={13} className="mr-1.5" />
            {sending ? "Sending..." : "Send Review Request"}
          </Button>
          <Button variant="outline" onClick={onClose} className="border-white/20 text-white/70">Cancel</Button>
        </div>
      </div>
    </div>
  );
};

// ── Stat Card ─────────────────────────────────────────────────────────────────

const StatCard = ({ icon: Icon, label, value, color }: {
  icon: React.ElementType; label: string; value: string | number; color: string;
}) => (
  <div className="rounded-2xl border p-4" style={{ background: `${color}10`, borderColor: `${color}25` }}>
    <Icon size={16} style={{ color }} className="mb-2" />
    <div className="text-2xl font-black text-white">{value}</div>
    <div className="text-xs font-semibold mt-0.5" style={{ color }}>{label}</div>
  </div>
);

// ── Main Component ─────────────────────────────────────────────────────────────

export default function ReviewLeaderboard() {
  const [logs, setLogs] = useState<ReviewLog[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showBlast, setShowBlast] = useState(false);

  const load = async () => {
    const [{ data: l }, { data: c }] = await Promise.all([
      supabase.from("review_blast_log").select("*").order("sent_at", { ascending: false }).limit(200),
      supabase.from("field_crm_clients").select("id, business_name, google_review_url").eq("status", "active"),
    ]);
    setLogs((l as ReviewLog[]) || []);
    setClients(c || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  // Build per-tech stats
  const techStats = Object.values(
    logs.reduce<Record<string, TechStat>>((acc, log) => {
      const name = log.tech_name || "Unassigned";
      if (!acc[name]) acc[name] = { name, sent: 0, clicked: 0, reviewed: 0, rate: 0 };
      acc[name].sent++;
      if (log.clicked_at) acc[name].clicked++;
      if (log.reviewed_at) acc[name].reviewed++;
      return acc;
    }, {})
  )
    .map((s) => ({ ...s, rate: s.sent > 0 ? Math.round((s.reviewed / s.sent) * 100) : 0 }))
    .sort((a, b) => b.reviewed - a.reviewed || b.rate - a.rate);

  const totalSent = logs.length;
  const totalClicked = logs.filter((l) => l.clicked_at).length;
  const totalReviewed = logs.filter((l) => l.reviewed_at).length;
  const convRate = totalSent > 0 ? Math.round((totalReviewed / totalSent) * 100) : 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Star size={32} className="text-orange-400 animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {showBlast && <SendBlastModal clients={clients} onClose={() => setShowBlast(false)} onSent={load} />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-white text-xl font-black flex items-center gap-2">
            <Star size={20} className="text-orange-400" />
            Review Engine
          </h2>
          <p className="text-white/40 text-sm mt-0.5">
            Auto-text customers after every job. Turn completions into 5-star reviews.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} className="border-white/15 text-white/60 hover:text-white">
            <RefreshCw size={13} className="mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowBlast(true)} className="bg-orange-500 hover:bg-orange-600 text-white">
            <Plus size={13} className="mr-1" /> Send Review Request
          </Button>
        </div>
      </div>

      {/* Overall stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={Send} label="Requests Sent" value={totalSent} color="#3b82f6" />
        <StatCard icon={MousePointerClick} label="Link Clicked" value={totalClicked} color="#f97316" />
        <StatCard icon={Star} label="Reviews Earned" value={totalReviewed} color="#f59e0b" />
        <StatCard icon={TrendingUp} label="Conversion Rate" value={`${convRate}%`} color="#10b981" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Tech Leaderboard */}
        <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Trophy size={16} className="text-amber-400" />
            <span className="text-white font-bold">Tech Leaderboard</span>
            <span className="text-white/30 text-xs ml-auto">Reviews earned</span>
          </div>

          {techStats.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">No review data yet. Send your first request!</p>
          ) : (
            <div className="space-y-2">
              {techStats.map((stat, idx) => (
                <motion.div key={stat.name} layout
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/4 hover:bg-white/6 transition-all">
                  <div className="text-lg w-6 text-center shrink-0">
                    {idx < 3 ? MEDAL[idx] : <span className="text-white/30 text-sm">#{idx + 1}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-white font-semibold text-sm truncate">{stat.name}</span>
                      <span className="text-amber-400 font-bold text-sm shrink-0">{stat.reviewed} ⭐</span>
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-white/10 rounded-full h-1.5">
                        <div className="h-1.5 rounded-full bg-gradient-to-r from-amber-500 to-orange-400 transition-all"
                          style={{ width: `${stat.rate}%` }} />
                      </div>
                      <span className="text-white/40 text-xs shrink-0">{stat.rate}%</span>
                    </div>
                  </div>
                  <div className="text-right shrink-0 text-xs text-white/40">
                    <div>{stat.sent} sent</div>
                    <div>{stat.clicked} clicked</div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        {/* Recent requests */}
        <div className="rounded-2xl border border-white/10 bg-white/3 p-5">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare size={16} className="text-blue-400" />
            <span className="text-white font-bold">Recent Requests</span>
          </div>

          {logs.length === 0 ? (
            <p className="text-white/30 text-sm text-center py-8">No requests sent yet.</p>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
              {logs.slice(0, 20).map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-3 rounded-xl bg-white/4">
                  <div className="mt-0.5 shrink-0">
                    {log.reviewed_at ? (
                      <Star size={13} className="text-amber-400" />
                    ) : log.clicked_at ? (
                      <MousePointerClick size={13} className="text-orange-400" />
                    ) : (
                      <Send size={13} className="text-white/30" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-white text-xs font-semibold">
                        {log.customer_name || log.customer_phone}
                      </span>
                      {log.reviewed_at && (
                        <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded-full">Reviewed ⭐</span>
                      )}
                      {log.clicked_at && !log.reviewed_at && (
                        <span className="text-[10px] bg-orange-500/20 text-orange-400 px-1.5 py-0.5 rounded-full">Clicked</span>
                      )}
                    </div>
                    <div className="text-white/40 text-xs mt-0.5 flex items-center gap-2 flex-wrap">
                      {log.tech_name && <span>{log.tech_name}</span>}
                      {log.job_description && <span>• {log.job_description}</span>}
                      <span className="flex items-center gap-1"><Phone size={9} />{log.customer_phone}</span>
                    </div>
                  </div>
                  <span className="text-white/25 text-xs shrink-0">{formatDate(log.sent_at)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

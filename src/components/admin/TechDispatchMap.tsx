// @ts-nocheck
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  MapPin, Clock, Wrench, Car, WifiOff, Users, CheckCircle,
  Plus, RefreshCw, Phone, Navigation,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface TechLocation {
  id: string;
  client_id: string;
  tech_name: string;
  tech_phone: string | null;
  lat: number | null;
  lng: number | null;
  address: string | null;
  status: "active" | "on_job" | "driving" | "offline";
  current_job: string | null;
  clocked_in_at: string | null;
  clocked_out_at: string | null;
  updated_at: string;
  field_crm_clients?: { business_name: string };
}

interface ClientRow { id: string; business_name: string }

// ── Helpers ────────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ElementType }> = {
  active:   { label: "Available",  color: "#10b981", bg: "#10b98120", icon: CheckCircle },
  on_job:   { label: "On Job",     color: "#f97316", bg: "#f9731620", icon: Wrench },
  driving:  { label: "Driving",    color: "#3b82f6", bg: "#3b82f620", icon: Car },
  offline:  { label: "Offline",    color: "#6b7280", bg: "#6b728020", icon: WifiOff },
};

function timeAgo(iso: string | null): string {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function clockedInDuration(iso: string | null): string {
  if (!iso) return "—";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ── Add Tech Modal ─────────────────────────────────────────────────────────────

const AddTechModal = ({ clients, onClose, onAdded }: {
  clients: ClientRow[]; onClose: () => void; onAdded: () => void;
}) => {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [clientId, setClientId] = useState(clients[0]?.id || "");
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim() || !clientId) return;
    setSaving(true);
    const { error } = await supabase.from("tech_locations").insert({
      client_id: clientId, tech_name: name.trim(), tech_phone: phone || null, status: "offline",
    });
    setSaving(false);
    if (error) { toast.error("Failed to add tech"); return; }
    toast.success(`${name} added to dispatch`);
    onAdded();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0f172a] border border-white/10 rounded-2xl p-6 max-w-sm w-full" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-white font-bold text-lg mb-4">Add Field Tech</h3>
        <div className="space-y-3">
          <div>
            <label className="text-white/60 text-xs mb-1 block">Tech Name</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Mike Johnson"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
          </div>
          <div>
            <label className="text-white/60 text-xs mb-1 block">Phone (optional)</label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="(313) 555-0100"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30" />
          </div>
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
        </div>
        <div className="flex gap-3 mt-5">
          <Button onClick={save} disabled={saving || !name.trim()} className="bg-orange-500 hover:bg-orange-600 flex-1">
            {saving ? "Adding..." : "Add Tech"}
          </Button>
          <Button variant="outline" onClick={onClose} className="border-white/20 text-white/70">Cancel</Button>
        </div>
      </div>
    </div>
  );
};

// ── Tech Card ──────────────────────────────────────────────────────────────────

const TechCard = ({ tech, onStatusChange }: {
  tech: TechLocation; onStatusChange: (id: string, status: string, job?: string) => void;
}) => {
  const cfg = STATUS_CONFIG[tech.status] || STATUS_CONFIG.offline;
  const Icon = cfg.icon;
  const [editJob, setEditJob] = useState(false);
  const [jobText, setJobText] = useState(tech.current_job || "");

  const handleStatusChange = (newStatus: string) => {
    onStatusChange(tech.id, newStatus, tech.current_job || undefined);
  };

  const saveJob = () => {
    onStatusChange(tech.id, tech.status, jobText);
    setEditJob(false);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border p-4 transition-all"
      style={{ background: cfg.bg, borderColor: `${cfg.color}30` }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: `${cfg.color}20` }}>
            <Icon size={16} style={{ color: cfg.color }} />
          </div>
          <div className="min-w-0">
            <div className="text-white font-bold text-sm truncate">{tech.tech_name}</div>
            <div className="text-white/40 text-xs">{tech.field_crm_clients?.business_name || "—"}</div>
          </div>
        </div>
        <Badge className="text-[10px] py-0 shrink-0" style={{ background: `${cfg.color}20`, color: cfg.color, border: `1px solid ${cfg.color}40` }}>
          {cfg.label}
        </Badge>
      </div>

      {/* Job info */}
      {editJob ? (
        <div className="flex gap-2 mb-3">
          <Input value={jobText} onChange={(e) => setJobText(e.target.value)}
            placeholder="Current job description..." autoFocus
            className="bg-white/10 border-white/20 text-white text-xs h-8 placeholder:text-white/30"
            onKeyDown={(e) => e.key === "Enter" && saveJob()} />
          <Button size="sm" onClick={saveJob} className="h-8 bg-orange-500 hover:bg-orange-600 text-xs shrink-0">Save</Button>
        </div>
      ) : (
        <button onClick={() => setEditJob(true)}
          className="w-full text-left mb-3 px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/8 border border-white/5 transition-all">
          {tech.current_job ? (
            <span className="text-white/70 text-xs">{tech.current_job}</span>
          ) : (
            <span className="text-white/25 text-xs italic">Click to set current job...</span>
          )}
        </button>
      )}

      {/* Meta */}
      <div className="flex items-center gap-3 text-xs text-white/40 mb-3 flex-wrap">
        {tech.clocked_in_at && tech.status !== "offline" && (
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {clockedInDuration(tech.clocked_in_at)} on shift
          </span>
        )}
        {tech.address && (
          <span className="flex items-center gap-1">
            <MapPin size={10} />
            {tech.address}
          </span>
        )}
        {tech.tech_phone && (
          <a href={`tel:${tech.tech_phone}`} className="flex items-center gap-1 hover:text-white transition-colors">
            <Phone size={10} />
            {tech.tech_phone}
          </a>
        )}
        <span className="flex items-center gap-1">
          <Navigation size={10} />
          {timeAgo(tech.updated_at)}
        </span>
      </div>

      {/* Status buttons */}
      <div className="grid grid-cols-4 gap-1">
        {(["active", "on_job", "driving", "offline"] as const).map((s) => {
          const c = STATUS_CONFIG[s];
          const active = tech.status === s;
          return (
            <button key={s} onClick={() => handleStatusChange(s)}
              className="py-1 rounded-lg text-[10px] font-semibold transition-all"
              style={{
                background: active ? `${c.color}30` : "rgba(255,255,255,0.04)",
                color: active ? c.color : "rgba(255,255,255,0.4)",
                border: `1px solid ${active ? `${c.color}50` : "rgba(255,255,255,0.08)"}`,
              }}>
              {c.label}
            </button>
          );
        })}
      </div>
    </motion.div>
  );
};

// ── Summary Bar ────────────────────────────────────────────────────────────────

const SummaryBar = ({ techs }: { techs: TechLocation[] }) => {
  const counts = techs.reduce<Record<string, number>>((acc, t) => {
    acc[t.status] = (acc[t.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="grid grid-cols-4 gap-3">
      {(["active", "on_job", "driving", "offline"] as const).map((s) => {
        const c = STATUS_CONFIG[s];
        const Icon = c.icon;
        return (
          <div key={s} className="rounded-2xl border p-3 text-center" style={{ background: `${c.color}10`, borderColor: `${c.color}25` }}>
            <Icon size={16} className="mx-auto mb-1" style={{ color: c.color }} />
            <div className="text-2xl font-black text-white">{counts[s] || 0}</div>
            <div className="text-[10px] font-semibold" style={{ color: c.color }}>{c.label}</div>
          </div>
        );
      })}
    </div>
  );
};

// ── Main Component ─────────────────────────────────────────────────────────────

export default function TechDispatchMap() {
  const [techs, setTechs] = useState<TechLocation[]>([]);
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");

  const load = async () => {
    const [{ data: t }, { data: c }] = await Promise.all([
      supabase.from("tech_locations").select("*, field_crm_clients(business_name)").order("tech_name"),
      supabase.from("field_crm_clients").select("id, business_name").eq("status", "active"),
    ]);
    setTechs((t as TechLocation[]) || []);
    setClients(c || []);
    setLoading(false);
  };

  const updateStatus = async (id: string, status: string, job?: string) => {
    const updates: Record<string, unknown> = { status, updated_at: new Date().toISOString() };
    if (job !== undefined) updates.current_job = job;
    if (status !== "offline" && !techs.find((t) => t.id === id)?.clocked_in_at) {
      updates.clocked_in_at = new Date().toISOString();
    }
    if (status === "offline") updates.clocked_out_at = new Date().toISOString();

    const { error } = await supabase.from("tech_locations").update(updates).eq("id", id);
    if (error) { toast.error("Update failed"); return; }
    setTechs((prev) => prev.map((t) => t.id === id ? { ...t, ...updates } as TechLocation : t));
  };

  useEffect(() => { load(); }, []);

  const displayed = filterStatus === "all" ? techs : techs.filter((t) => t.status === filterStatus);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <MapPin size={32} className="text-orange-400 animate-bounce" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-1">
      {showAdd && <AddTechModal clients={clients} onClose={() => setShowAdd(false)} onAdded={load} />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-white text-xl font-black flex items-center gap-2">
            <MapPin size={20} className="text-orange-400" />
            Dispatch Map
          </h2>
          <p className="text-white/40 text-sm mt-0.5">Where's your team right now?</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load} className="border-white/15 text-white/60 hover:text-white">
            <RefreshCw size={13} className="mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)} className="bg-orange-500 hover:bg-orange-600 text-white">
            <Plus size={13} className="mr-1" /> Add Tech
          </Button>
        </div>
      </div>

      {/* Summary counts */}
      <SummaryBar techs={techs} />

      {/* Filter */}
      {techs.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-white/40 text-xs">Filter:</span>
          {["all", "active", "on_job", "driving", "offline"].map((s) => {
            const c = s === "all" ? { color: "#f97316" } : STATUS_CONFIG[s];
            return (
              <button key={s} onClick={() => setFilterStatus(s)}
                className="px-3 py-1 rounded-full text-xs font-semibold transition-all"
                style={{
                  background: filterStatus === s ? `${c.color}25` : "rgba(255,255,255,0.05)",
                  color: filterStatus === s ? c.color : "rgba(255,255,255,0.4)",
                  border: `1px solid ${filterStatus === s ? `${c.color}50` : "rgba(255,255,255,0.08)"}`,
                }}>
                {s === "all" ? "All Techs" : STATUS_CONFIG[s].label}
              </button>
            );
          })}
        </div>
      )}

      {/* Tech grid */}
      {displayed.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-16 text-center">
          <Users size={40} className="text-white/15 mx-auto mb-4" />
          <p className="text-white/40 text-sm">No techs yet.</p>
          <p className="text-white/25 text-xs mt-1">Add your field techs to start tracking.</p>
          <Button onClick={() => setShowAdd(true)} className="mt-4 bg-orange-500 hover:bg-orange-600 text-white">
            <Plus size={14} className="mr-1" /> Add First Tech
          </Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {displayed.map((tech) => (
              <TechCard key={tech.id} tech={tech} onStatusChange={updateStatus} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

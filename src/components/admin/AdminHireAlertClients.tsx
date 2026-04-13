import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Bell, Plus, RefreshCw, Users, DollarSign, Trash2, Pencil,
  Mail, Phone, CheckCircle, XCircle, Clock, Play,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface HireAlertClient {
  id: string;
  company_name: string;
  owner_email: string;
  owner_phone: string | null;
  stripe_customer_id: string | null;
  active: boolean;
  plan: "bundle" | "standalone";
  target_roles: string[];
  notify_email: boolean;
  notify_sms: boolean;
  created_at: string;
}

interface ScannerRun {
  id: string;
  run_at: string;
  source: string;
  candidates_found: number;
  alerts_sent: number;
  errors: unknown;
}

interface Candidate {
  id: string;
  full_name: string;
  license_type: string | null;
  city: string | null;
  source: string;
  status: string;
  first_seen_at: string;
}

const ROLE_LABELS: Record<string, string> = {
  boiler_operator: "Boiler Op",
  hvac_tech: "HVAC",
  plumber: "Plumber",
  electrician: "Electrician",
  pipefitter: "Pipefitter",
  steam_engineer: "Steam Eng",
  refrigeration_tech: "Refrigeration",
  fire_suppression: "Fire Suppression",
  cna: "CNA",
  rn: "RN",
  lpn: "LPN",
  director_of_nursing: "DON",
  home_health_aide: "Home Health",
};

const HEALTHCARE_ROLES = ["cna", "rn", "lpn", "director_of_nursing", "home_health_aide"];

// ── Add/Edit Modal ─────────────────────────────────────────────────────────────

function ClientModal({ existing, onClose, onSaved }: {
  existing?: HireAlertClient; onClose: () => void; onSaved: () => void;
}) {
  const ALL_ROLES = Object.keys(ROLE_LABELS);
  const [form, setForm] = useState({
    company_name: existing?.company_name ?? "",
    owner_email: existing?.owner_email ?? "",
    owner_phone: existing?.owner_phone ?? "",
    plan: existing?.plan ?? "standalone" as "bundle" | "standalone",
    target_roles: existing?.target_roles ?? ["boiler_operator", "hvac_tech"],
    active: existing?.active ?? true,
    notify_email: existing?.notify_email ?? true,
    notify_sms: existing?.notify_sms ?? false,
  });
  const [saving, setSaving] = useState(false);

  const toggleRole = (role: string) => {
    setForm(f => ({
      ...f,
      target_roles: f.target_roles.includes(role)
        ? f.target_roles.filter(r => r !== role)
        : [...f.target_roles, role],
    }));
  };

  const save = async () => {
    if (!form.company_name.trim() || !form.owner_email.trim()) {
      toast.error("Company name and email required");
      return;
    }
    setSaving(true);
    const payload = { ...form };
    const { error } = existing
      ? await (supabase as any).from("hire_alert_clients").update(payload).eq("id", existing.id)
      : await (supabase as any).from("hire_alert_clients").insert(payload);
    setSaving(false);
    if (error) { toast.error("Save failed: " + error.message); return; }
    toast.success(existing ? "Client updated" : `${form.company_name} added!`);
    onSaved();
    onClose();
  };

  const label = "text-white/50 text-xs mb-1 block";
  const inp = "bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-[#0a0f1e] border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-black text-lg">{existing ? "Edit TechAlert Client" : "Add TechAlert Client"}</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="space-y-3">
          <div>
            <label className={label}>Company Name *</label>
            <Input value={form.company_name} onChange={e => setForm(f => ({ ...f, company_name: e.target.value }))}
              placeholder="D.J. Conley Associates" className={inp} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Owner Email *</label>
              <Input value={form.owner_email} onChange={e => setForm(f => ({ ...f, owner_email: e.target.value }))}
                placeholder="pat@djconley.com" className={inp} />
            </div>
            <div>
              <label className={label}>Phone</label>
              <Input value={form.owner_phone ?? ""} onChange={e => setForm(f => ({ ...f, owner_phone: e.target.value }))}
                placeholder="(313) 555-0100" className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Plan</label>
              <select value={form.plan} onChange={e => setForm(f => ({ ...f, plan: e.target.value as "bundle" | "standalone" }))}
                className="w-full h-10 rounded-md border border-white/10 bg-white/5 text-white text-sm px-3">
                <option value="standalone">Standalone ($99/mo)</option>
                <option value="bundle">Bundle ($49/mo)</option>
              </select>
            </div>
            <div>
              <label className={label}>Status</label>
              <select value={form.active ? "active" : "inactive"}
                onChange={e => setForm(f => ({ ...f, active: e.target.value === "active" }))}
                className="w-full h-10 rounded-md border border-white/10 bg-white/5 text-white text-sm px-3">
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>

          <div>
            <label className={label}>Target Roles (click to toggle)</label>
            <div className="flex flex-wrap gap-2 mt-1">
              {ALL_ROLES.map(role => {
                const active = form.target_roles.includes(role);
                return (
                  <button key={role} onClick={() => toggleRole(role)}
                    className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                    style={{
                      background: active ? "#f59e0b20" : "#ffffff08",
                      color: active ? "#f59e0b" : "rgba(255,255,255,0.4)",
                      border: `1px solid ${active ? "#f59e0b40" : "rgba(255,255,255,0.1)"}`,
                    }}>
                    {ROLE_LABELS[role]}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center gap-4 pt-1">
            <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
              <input type="checkbox" checked={form.notify_email}
                onChange={e => setForm(f => ({ ...f, notify_email: e.target.checked }))}
                className="rounded" />
              Email alerts
            </label>
            <label className="flex items-center gap-2 text-xs text-white/50 cursor-pointer">
              <input type="checkbox" checked={form.notify_sms}
                onChange={e => setForm(f => ({ ...f, notify_sms: e.target.checked }))}
                className="rounded" />
              SMS alerts
            </label>
          </div>
        </div>

        <div className="flex gap-3 mt-5">
          <Button onClick={save} disabled={saving}
            className="bg-orange-500 hover:bg-orange-600 text-white flex-1">
            {saving ? "Saving..." : existing ? "Save Changes" : "Add Client"}
          </Button>
          <Button variant="outline" onClick={onClose} className="border-white/15 text-white/60">Cancel</Button>
        </div>
      </div>
    </div>
  );
}

// ── Client Card ────────────────────────────────────────────────────────────────

function ClientCard({ client, onEdit, onDelete }: {
  client: HireAlertClient; onEdit: () => void; onDelete: () => void;
}) {
  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/8 bg-white/3 p-5 hover:border-white/15 transition-all">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-black text-sm">{client.company_name}</h3>
            <Badge className="text-[10px] py-0"
              style={{
                background: client.active ? "#10b98120" : "#6b728020",
                color: client.active ? "#10b981" : "#6b7280",
                border: `1px solid ${client.active ? "#10b98130" : "#6b728030"}`,
              }}>
              {client.active ? "Active" : "Inactive"}
            </Badge>
            <Badge className="text-[10px] py-0"
              style={{
                background: client.plan === "bundle" ? "#3b82f620" : "#8b5cf620",
                color: client.plan === "bundle" ? "#3b82f6" : "#8b5cf6",
                border: `1px solid ${client.plan === "bundle" ? "#3b82f630" : "#8b5cf630"}`,
              }}>
              {client.plan === "bundle" ? "Bundle $49" : "Standalone $99"}
            </Badge>
          </div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 rounded-lg hover:bg-white/8 text-white/40 hover:text-white transition-colors">
            <Pencil size={12} />
          </button>
          <button onClick={onDelete} className="p-1.5 rounded-lg hover:bg-red-500/15 text-white/40 hover:text-red-400 transition-colors">
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      <div className="space-y-1.5 mb-3">
        <div className="flex items-center gap-2 text-xs text-white/40">
          <Mail size={11} />
          <span className="truncate">{client.owner_email}</span>
        </div>
        {client.owner_phone && (
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Phone size={11} />
            <span>{client.owner_phone}</span>
          </div>
        )}
      </div>

      {/* Target roles */}
      <div className="flex flex-wrap gap-1.5 mb-3">
        {(client.target_roles || []).map(role => (
          <span key={role} className="px-2 py-0.5 rounded-md text-[10px] font-semibold"
            style={{ background: "#f59e0b15", color: "#f59e0b", border: "1px solid #f59e0b25" }}>
            {ROLE_LABELS[role] || role}
          </span>
        ))}
      </div>

      {/* Notify flags */}
      <div className="flex items-center gap-3 text-[10px]">
        <span className={`flex items-center gap-1 ${client.notify_email ? "text-emerald-400" : "text-white/25"}`}>
          {client.notify_email ? <CheckCircle size={10} /> : <XCircle size={10} />}
          Email
        </span>
        <span className={`flex items-center gap-1 ${client.notify_sms ? "text-emerald-400" : "text-white/25"}`}>
          {client.notify_sms ? <CheckCircle size={10} /> : <XCircle size={10} />}
          SMS
        </span>
        <span className="text-white/25 ml-auto">
          {new Date(client.created_at).toLocaleDateString()}
        </span>
      </div>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminHireAlertClients() {
  const [clients, setClients] = useState<HireAlertClient[]>([]);
  const [runs, setRuns] = useState<ScannerRun[]>([]);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editClient, setEditClient] = useState<HireAlertClient | undefined>();
  const [sectorFilter, setSectorFilter] = useState<"all" | "trades" | "healthcare">("all");

  const load = async () => {
    setLoading(true);
    const [{ data: cData }, { data: rData }, { data: candData }] = await Promise.all([
      (supabase as any).from("hire_alert_clients").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("hire_alert_runs").select("*").order("run_at", { ascending: false }).limit(10),
      (supabase as any).from("hire_alert_candidates").select("id,full_name,license_type,city,source,status,first_seen_at")
        .order("first_seen_at", { ascending: false }).limit(20),
    ]);
    setClients(cData || []);
    setRuns(rData || []);
    setCandidates(candData || []);
    setLoading(false);
  };

  const deleteClient = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from TechAlert?`)) return;
    await (supabase as any).from("hire_alert_clients").delete().eq("id", id);
    toast.success(`${name} removed`);
    load();
  };

  useEffect(() => { load(); }, []);

  const filteredClients = clients.filter(c => {
    if (sectorFilter === "all") return true;
    const hasHealthcare = (c.target_roles || []).some(r => HEALTHCARE_ROLES.includes(r));
    return sectorFilter === "healthcare" ? hasHealthcare : !hasHealthcare;
  });
  const activeClients = filteredClients.filter(c => c.active);
  const mrr = activeClients.reduce((s, c) => s + (c.plan === "bundle" ? 4900 : 9900), 0);

  const invokeScanner = async () => {
    setInvoking(true);
    try {
      const { error } = await supabase.functions.invoke("hire-alert-scanner");
      if (error) throw error;
      toast.success("Scanner running — check email in ~60s");
      setTimeout(load, 5000);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Scanner failed");
    } finally {
      setInvoking(false);
    }
  };

  return (
    <div className="space-y-6 p-1">
      {showAdd && <ClientModal onClose={() => setShowAdd(false)} onSaved={load} />}
      {editClient && <ClientModal existing={editClient} onClose={() => setEditClient(undefined)} onSaved={load} />}

      {/* Header */}
      <div className="space-y-3">
        <div>
          <h2 className="text-white text-xl font-black flex items-center gap-2">
            <Bell size={20} className="text-amber-400" />
            TechAlert Clients
          </h2>
          <p className="text-white/40 text-sm mt-0.5">Manage subscribers and monitor scanner runs.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={load} className="border-white/15 text-white/60 hover:text-white">
            <RefreshCw size={13} className="mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={invokeScanner} disabled={invoking}
            className="bg-amber-500 hover:bg-amber-600 text-white">
            <Play size={13} className="mr-1" /> {invoking ? "Running..." : "Run Scanner"}
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)} className="bg-orange-500 hover:bg-orange-600 text-white">
            <Plus size={13} className="mr-1" /> Add Client
          </Button>
        </div>
        {/* Sector filter */}
        <div className="flex items-center gap-1 ml-auto">
          {(["all", "trades", "healthcare"] as const).map(f => (
            <button key={f} onClick={() => setSectorFilter(f)}
              className={`px-3 py-1 rounded-full text-xs font-bold transition-colors ${sectorFilter === f ? "bg-amber-500 text-white" : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"}`}>
              {f === "all" ? "All" : f === "trades" ? "🔧 Trades" : "🏥 Healthcare"}
            </button>
          ))}
        </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Users, label: "Active Clients", value: activeClients.length, color: "#10b981" },
          { icon: DollarSign, label: "Monthly Revenue", value: `$${(mrr / 100).toLocaleString()}`, color: "#e8621a" },
          { icon: Bell, label: "Candidates in DB", value: candidates.length >= 20 ? "20+" : candidates.length, color: "#f59e0b" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-2xl border p-4" style={{ background: `${color}0d`, borderColor: `${color}25` }}>
            <Icon size={16} style={{ color }} className="mb-2" />
            <div className="text-2xl font-black text-white">{loading ? "—" : value}</div>
            <div className="text-xs font-semibold mt-0.5" style={{ color }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Client grid */}
      {loading ? (
        <div className="flex items-center justify-center h-32">
          <div className="w-8 h-8 rounded-full border-2 border-amber-500/30 border-t-amber-500 animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-16 text-center">
          <Bell size={40} className="text-white/15 mx-auto mb-4" />
          <p className="text-white/40 text-sm">No TechAlert clients yet.</p>
          <p className="text-white/25 text-xs mt-1">Run a $0 test checkout from the DWA Overview tab to seed one.</p>
          <Button onClick={() => setShowAdd(true)} className="mt-5 bg-orange-500 hover:bg-orange-600 text-white">
            <Plus size={14} className="mr-1.5" /> Add First Client
          </Button>
        </div>
      ) : (
        <AnimatePresence>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map(c => (
              <ClientCard key={c.id} client={c}
                onEdit={() => setEditClient(c)}
                onDelete={() => deleteClient(c.id, c.company_name)} />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* Scanner runs */}
      {runs.length > 0 ? (
        <div>
          <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
            <Clock size={12} /> Recent Scanner Runs
          </p>
          <div className="rounded-2xl border border-white/8 overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 500 }}>
              <thead>
                <tr className="border-b border-white/8 bg-white/3">
                  <th className="text-left px-4 py-3 text-white/40 font-semibold">Run At</th>
                  <th className="text-left px-4 py-3 text-white/40 font-semibold">Source</th>
                  <th className="text-right px-4 py-3 text-white/40 font-semibold">Found</th>
                  <th className="text-right px-4 py-3 text-white/40 font-semibold">Alerts Sent</th>
                  <th className="text-right px-4 py-3 text-white/40 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/3">
                    <td className="px-4 py-2.5 text-white/60">{new Date(r.run_at).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-white/60 capitalize">{r.source || "all"}</td>
                    <td className="px-4 py-2.5 text-right text-white font-semibold">{r.candidates_found}</td>
                    <td className="px-4 py-2.5 text-right text-emerald-400 font-semibold">{r.alerts_sent}</td>
                    <td className="px-4 py-2.5 text-right">
                      {r.errors ? (
                        <span className="text-red-400">Error</span>
                      ) : (
                        <span className="text-emerald-400">OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-amber-500/20 bg-amber-500/5 p-8 text-center">
          <Clock size={28} className="text-amber-400/40 mx-auto mb-3" />
          <p className="text-white/60 text-sm font-semibold mb-1">No scanner runs yet</p>
          <p className="text-white/30 text-xs mb-4">Click "Run Scanner" above to trigger the first scan. Results will appear here.</p>
          <Button size="sm" onClick={invokeScanner} disabled={invoking}
            className="bg-amber-500 hover:bg-amber-600 text-white">
            <Play size={13} className="mr-1" /> {invoking ? "Running..." : "Run First Scan"}
          </Button>
        </div>
      )}

      {/* Recent candidates */}
      {candidates.length > 0 && (
        <div>
          <p className="text-white/50 text-xs font-bold uppercase tracking-wider mb-3 flex items-center gap-2">
            <Users size={12} /> Recent Candidates
          </p>
          <div className="rounded-2xl border border-white/8 overflow-x-auto">
            <table className="w-full text-xs" style={{ minWidth: 500 }}>
              <thead>
                <tr className="border-b border-white/8 bg-white/3">
                  <th className="text-left px-4 py-3 text-white/40 font-semibold">Name</th>
                  <th className="text-left px-4 py-3 text-white/40 font-semibold">License / Role</th>
                  <th className="text-left px-4 py-3 text-white/40 font-semibold">City</th>
                  <th className="text-left px-4 py-3 text-white/40 font-semibold">Source</th>
                  <th className="text-right px-4 py-3 text-white/40 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {candidates.map(c => {
                  const statusColor: Record<string, string> = {
                    alerted: "#f59e0b", new: "#10b981", hired: "#3b82f6", inactive: "#6b7280",
                  };
                  const color = statusColor[c.status] || "#6b7280";
                  return (
                    <tr key={c.id} className="border-b border-white/5 hover:bg-white/3">
                      <td className="px-4 py-2.5 text-white font-medium">{c.full_name}</td>
                      <td className="px-4 py-2.5 text-white/60">{c.license_type || "—"}</td>
                      <td className="px-4 py-2.5 text-white/60">{c.city || "—"}</td>
                      <td className="px-4 py-2.5 text-white/60 capitalize">{c.source}</td>
                      <td className="px-4 py-2.5 text-right">
                        <span className="px-2 py-0.5 rounded-md font-semibold capitalize"
                          style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}>
                          {c.status}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

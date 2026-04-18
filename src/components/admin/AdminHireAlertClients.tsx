import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Bell, Plus, RefreshCw, Users, DollarSign, Trash2, Pencil,
  Mail, Phone, CheckCircle, XCircle, Clock, Play, FileText, Loader2,
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
  cross_referenced: boolean;
  data_completeness: number;
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
  pressure_vessel: "PVI",
  industrial_mechanic: "Ind. Mech",
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
  const [invoking, setInvoking] = useState(false);
  const [sectorFilter, setSectorFilter] = useState<"all" | "trades" | "healthcare">("all");
  const [generatingPDF, setGeneratingPDF] = useState(false);

  const load = async () => {
    setLoading(true);
    const [{ data: cData }, { data: rData }, { data: candData }] = await Promise.all([
      (supabase as any).from("hire_alert_clients").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("hire_alert_runs").select("*").order("run_at", { ascending: false }).limit(10),
      (supabase as any).from("hire_alert_candidates").select("id,full_name,license_type,city,source,status,first_seen_at,cross_referenced,data_completeness,phone,phone_type,phone_verified_at")
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

  const [verifying, setVerifying] = useState(false);
  const verifyPhones = async () => {
    if (candidates.length === 0) {
      toast.info("No candidates in DB yet — run the scanner first, then verify phones.");
      return;
    }
    setVerifying(true);
    try {
      const { data, error } = await supabase.functions.invoke("verify-candidate-phones");
      if (error) throw new Error(error.message || "Function error");
      const d = data as { verified: number; summary?: Record<string, number>; message?: string; error?: string };
      if (d.error) throw new Error(d.error);
      if (d.verified === 0) {
        toast.success(d.message || "All phones already verified");
      } else {
        const parts = Object.entries(d.summary ?? {}).map(([t, n]) => `${n} ${t}`).join(", ");
        toast.success(`Verified ${d.verified} phones: ${parts}`);
      }
      setTimeout(load, 1500);
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setVerifying(false);
    }
  };

  // ── PDF Generator ──────────────────────────────────────────────────────────
  function buildPDFHTML(report: any): string {
    const { report_date, summary, candidates: cands } = report;

    const tradeRows = Object.entries(summary.trades as Record<string, number>)
      .sort((a, b) => (b[1] as number) - (a[1] as number))
      .map(([trade, count]) => {
        const bars = "█".repeat(Math.min((count as number) * 2, 24));
        return `<div class="trade-row"><span class="trade-name">${trade}</span><span class="trade-bar">${bars}</span><span class="trade-count">${count}</span></div>`;
      }).join("");

    const candidateCards = cands.map((c: any) => {
      const isHigh = c.score >= 8 || c.availability_label === "Newly Licensed" || c.availability_label === "Actively Seeking Work";
      const isMed = !isHigh && c.score >= 6;
      const borderColor = isHigh ? "#10b981" : isMed ? "#f59e0b" : "#94a3b8";
      const priorityLabel = isHigh ? "HIGH PRIORITY" : isMed ? "AVAILABLE" : "MONITOR";
      const priorityColor = isHigh ? "#10b981" : isMed ? "#f59e0b" : "#94a3b8";

      const contactParts = [
        c.phone ? `📞 ${c.phone}` : null,
        c.email ? `✉ ${c.email}` : null,
        c.linkedin_url ? `<a href="${c.linkedin_url}" style="color:#3b82f6;text-decoration:none;">LinkedIn →</a>` : null,
      ].filter(Boolean);
      const contactLine = contactParts.join("&nbsp;&nbsp;&nbsp;");

      return `<div class="candidate-card" style="border-left:4px solid ${borderColor};">
        <div class="card-header">
          <span class="priority-label" style="color:${priorityColor};">${priorityLabel}</span>
          ${c.city ? `<span class="city">📍 ${c.city}, MI</span>` : ""}
        </div>
        <div class="candidate-name">${c.full_name}</div>
        <div class="candidate-trade">${c.license_type}</div>
        ${c.license_number ? `<div class="license-row">License #: ${c.license_number}${c.license_expiry ? `&nbsp;&nbsp;·&nbsp;&nbsp;Exp: ${c.license_expiry}` : ""}<br/><span class="verify-link">→ Verify at michigan.gov/lara — search by license number</span></div>` : ""}
        <div class="why-now">WHY NOW: ${c.why_now}</div>
        ${c.current_employer ? `<div class="detail-row">Currently at: ${c.current_employer}</div>` : ""}
        ${c.years_experience ? `<div class="detail-row">${c.years_experience}+ years experience</div>` : ""}
        <div class="card-footer">
          <span>${contactLine || "Contact info available upon subscription activation"}</span>
          ${c.first_seen ? `<span class="identified">Identified: ${c.first_seen}</span>` : ""}
        </div>
      </div>`;
    }).join("");

    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>TechAlert Intelligence Report — DJ Conley</title>
    <style>
      @page { size: letter; margin: 0.6in; }
      @media print { .cover { page-break-after: always; } .closing { page-break-before: always; } .candidate-card { page-break-inside: avoid; } }
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: Georgia, serif; color: #1e293b; font-size: 13px; line-height: 1.6; }
      .cover { background: #0a1628; color: white; padding: 60px; min-height: 100vh; }
      .cover-brand { color: #00d4ff; font-family: monospace; font-size: 13px; font-weight: 900; letter-spacing: 4px; text-transform: uppercase; margin-bottom: 16px; }
      .cover-title { font-size: 36px; font-weight: 900; color: white; line-height: 1.1; margin-bottom: 8px; }
      .cover-sub { color: #00d4ff; font-size: 18px; font-weight: 700; margin-bottom: 4px; }
      .cover-date { color: #64748b; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 40px; }
      .divider { border: none; border-top: 1px solid rgba(255,255,255,0.1); margin: 32px 0; }
      .section-label { color: #00d4ff; font-family: sans-serif; font-size: 10px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; margin-bottom: 20px; }
      .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 40px; }
      .kpi-box { background: rgba(0,212,255,0.06); border: 1px solid rgba(0,212,255,0.15); border-radius: 8px; padding: 20px; text-align: center; }
      .kpi-number { font-size: 40px; font-weight: 900; color: #00d4ff; font-family: sans-serif; line-height: 1; }
      .kpi-label { color: #64748b; font-size: 9px; letter-spacing: 2px; text-transform: uppercase; font-family: sans-serif; margin-top: 6px; }
      .trade-row { display: flex; align-items: center; gap: 12px; margin-bottom: 8px; }
      .trade-name { color: #94a3b8; font-family: sans-serif; font-size: 11px; width: 160px; flex-shrink: 0; }
      .trade-bar { color: #00d4ff; font-size: 10px; flex: 1; }
      .trade-count { color: white; font-family: sans-serif; font-size: 11px; font-weight: 700; width: 30px; text-align: right; }
      .pitch-block { margin-top: 8px; }
      .pitch-block p { color: #94a3b8; font-size: 13px; line-height: 1.8; margin-bottom: 12px; }
      .pitch-block .highlight { color: white; font-weight: 700; }
      .math-box { background: rgba(0,212,255,0.05); border: 1px solid rgba(0,212,255,0.2); border-radius: 6px; padding: 20px; margin-top: 24px; font-family: monospace; font-size: 13px; color: #94a3b8; line-height: 2; }
      .math-box .math-total { color: #00d4ff; font-weight: 900; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 8px; margin-top: 4px; }
      .candidates-section { padding: 40px 0; }
      .candidate-card { border: 1px solid #e2e8f0; border-radius: 8px; padding: 24px; margin-bottom: 20px; }
      .card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
      .priority-label { font-family: sans-serif; font-size: 9px; font-weight: 900; letter-spacing: 3px; text-transform: uppercase; }
      .city { font-family: sans-serif; font-size: 11px; color: #64748b; }
      .candidate-name { font-size: 22px; font-weight: 900; color: #0f172a; margin-bottom: 2px; }
      .candidate-trade { font-family: sans-serif; font-size: 12px; color: #00d4ff; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 16px; }
      .license-row { background: #f8fafc; border-radius: 4px; padding: 10px 14px; margin-bottom: 12px; font-family: monospace; font-size: 12px; color: #1e293b; }
      .verify-link { color: #64748b; font-size: 10px; font-family: sans-serif; }
      .why-now { background: #f0fdf4; border-left: 3px solid #10b981; padding: 10px 14px; margin-bottom: 12px; font-size: 12px; color: #166534; font-style: italic; }
      .detail-row { font-family: sans-serif; font-size: 11px; color: #64748b; margin-bottom: 4px; }
      .card-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 12px; margin-top: 12px; font-family: sans-serif; font-size: 11px; color: #475569; }
      .identified { color: #94a3b8; font-size: 10px; }
      .closing { padding: 60px; background: #0a1628; color: white; min-height: 100vh; }
      .closing-title { font-size: 32px; font-weight: 900; color: white; margin-bottom: 32px; }
      .closing p { color: #94a3b8; font-size: 14px; line-height: 1.9; margin-bottom: 16px; max-width: 560px; }
      .closing .em { color: white; font-weight: 700; font-style: normal; }
      .closing-math { background: rgba(0,212,255,0.05); border: 1px solid rgba(0,212,255,0.2); border-radius: 8px; padding: 24px; margin: 32px 0; font-family: monospace; font-size: 14px; color: #94a3b8; line-height: 2.2; }
      .closing-math .total-line { color: #00d4ff; font-weight: 900; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 12px; margin-top: 8px; }
      .closing-cta { margin-top: 40px; padding-top: 32px; border-top: 1px solid rgba(255,255,255,0.1); }
      .closing-cta p { color: #64748b; font-size: 12px; margin-bottom: 6px; }
      .closing-cta .contact { color: #00d4ff; font-size: 15px; font-weight: 700; font-family: sans-serif; }
      .page-footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-family: sans-serif; font-size: 9px; color: #cbd5e1; letter-spacing: 1px; text-align: center; }
    </style></head><body>

    <div class="cover">
      <div class="cover-brand">⚡ TechAlert</div>
      <div class="cover-title">Staffing Intelligence<br/>Report</div>
      <div class="cover-sub">Prepared for: DJ Conley</div>
      <div class="cover-date">${report_date}&nbsp;&nbsp;·&nbsp;&nbsp;Confidential</div>
      <hr class="divider"/>
      <div class="section-label">What We Found</div>
      <div class="kpi-grid">
        <div class="kpi-box"><div class="kpi-number">${summary.total}</div><div class="kpi-label">Candidates<br/>Identified</div></div>
        <div class="kpi-box"><div class="kpi-number">${summary.hot}</div><div class="kpi-label">High Priority<br/>Available</div></div>
        <div class="kpi-box"><div class="kpi-number">${summary.with_contact}</div><div class="kpi-label">Have Contact<br/>Info</div></div>
        <div class="kpi-box"><div class="kpi-number">${summary.local}</div><div class="kpi-label">In Metro<br/>Detroit</div></div>
      </div>
      <div class="section-label">Trades Monitored</div>
      <div>${tradeRows}</div>
      <hr class="divider"/>
      <div class="section-label">The Difference</div>
      <div class="pitch-block">
        <p>Staffing agencies find people who are <span class="highlight">already looking</span>. They're interviewing at five companies. You're competing for them the same as everyone else — and paying $10,000 for the privilege.</p>
        <p><span class="highlight">TechAlert finds people before they start looking.</span></p>
        <p>The boiler operator who got his license two weeks ago. The journeyman who just finished his apprenticeship. The plumber whose license lapsed — which usually means he just left a job and hasn't landed somewhere yet.</p>
        <p>You call them first. You stay in control of your own hiring. No agency. No middleman. No finder's fee.</p>
        <div class="math-box">
          Staffing agency — one placement:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;$8,000–$12,000<br/>
          TechAlert — full year:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;$1,788<br/>
          <div class="math-total">You break even on the first hire. Every hire after that is pure profit.</div>
        </div>
      </div>
    </div>

    <div class="candidates-section">
      ${candidateCards}
      <div class="page-footer">TechAlert Intelligence Report&nbsp;&nbsp;·&nbsp;&nbsp;Confidential&nbsp;&nbsp;·&nbsp;&nbsp;Prepared exclusively for DJ Conley&nbsp;&nbsp;·&nbsp;&nbsp;detroitwebagency.com</div>
    </div>

    <div class="closing">
      <div class="closing-title">This Is Not<br/>A Staffing Agency.</div>
      <p>Staffing agencies handle everything — recruiting, screening, onboarding, payroll. That's why they charge $8,000 to $12,000 every time they place someone. And you still end up managing that person yourself.</p>
      <p><span class="em">TechAlert is something different.</span></p>
      <p>We don't hire for you. We don't send you résumés from people who are already interviewing at five other companies. We don't take a cut of anyone's salary.</p>
      <p><span class="em">We give you the first call.</span></p>
      <p>When a boiler operator passes his Michigan licensing exam, we know about it within 24 hours. When a journeyman electrician finishes his apprenticeship, we find him before he posts a résumé anywhere. When a plumber's license lapses — which usually means he just left a job — we flag him for you.</p>
      <p>You make the call. You run the interview. You decide. No agency fees. No middleman. No loss of control.</p>
      <p>You've been hiring tradespeople for years. You know how to evaluate them. The only thing you've been missing is <span class="em">finding them before your competitors do</span>. That's what TechAlert does.</p>
      <div class="closing-math">
        One boiler operator via staffing agency:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;$10,000<br/>
        TechAlert for a full year:&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;$1,788<br/>
        <div class="total-line">You come out ahead the moment you make one hire.<br/>And every hire after that is pure profit.</div>
      </div>
      <div class="closing-cta">
        <p>$149/month. No contracts. Cancel anytime.</p>
        <p>The candidates in this report were found in the last 30 days.</p>
        <p><span class="em" style="color:white;">Your competitors don't have this list.</span></p>
        <p class="contact">detroitwebagency.com/hire-alert</p>
        <p class="contact">Matt Michels&nbsp;&nbsp;·&nbsp;&nbsp;(313) 992-1219&nbsp;&nbsp;·&nbsp;&nbsp;matt@detroitwebagent.com</p>
      </div>
    </div>

    </body></html>`;
  }

  function openPDFWindow(report: any) {
    const win = window.open("", "_blank");
    if (!win) { toast.error("Allow popups to generate PDF"); return; }
    win.document.write(buildPDFHTML(report));
    win.document.close();
    setTimeout(() => win.print(), 900);
  }

  async function generateDemoPDF() {
    setGeneratingPDF(true);
    try {
      const res = await supabase.functions.invoke("generate-demo-report");
      if (res.error || !res.data) throw new Error(res.error?.message || "No data");
      openPDFWindow(res.data);
    } catch (e: any) {
      toast.error(e.message || "Failed — run the scanner first to populate candidates");
    } finally {
      setGeneratingPDF(false);
    }
  }

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
          <Button size="sm" onClick={verifyPhones} disabled={verifying}
            className="bg-emerald-600 hover:bg-emerald-700 text-white">
            {verifying ? <Loader2 size={13} className="mr-1 animate-spin" /> : <Phone size={13} className="mr-1" />}
            {verifying ? "Verifying..." : "Verify Phones"}
          </Button>
          <Button size="sm" onClick={generateDemoPDF} disabled={generatingPDF}
            className="text-white" style={{ background: "#00d4ff", opacity: generatingPDF ? 0.7 : 1 }}>
            {generatingPDF ? <Loader2 size={13} className="mr-1 animate-spin" /> : <FileText size={13} className="mr-1" />}
            {generatingPDF ? "Generating..." : "📄 Generate Demo PDF"}
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
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
      ) : filteredClients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-16 text-center">
          <Bell size={40} className="text-white/15 mx-auto mb-4" />
          <p className="text-white/40 text-sm">{sectorFilter === "all" ? "No TechAlert clients yet." : `No ${sectorFilter} clients found.`}</p>
          <p className="text-white/25 text-xs mt-1">Run a $0 test checkout from the DWA Overview tab to seed one.</p>
          <Button onClick={() => setShowAdd(true)} className="mt-5 bg-orange-500 hover:bg-orange-600 text-white">
            <Plus size={14} className="mr-1.5" /> Add First Client
          </Button>
        </div>
      ) : (
        <AnimatePresence>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredClients.map(c => (
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
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/8 bg-white/3">
                  <th className="text-left px-4 py-3 text-white/40 font-semibold">Run At</th>
                  <th className="text-left px-4 py-3 text-white/40 font-semibold hidden sm:table-cell">Source</th>
                  <th className="text-right px-4 py-3 text-white/40 font-semibold">Found</th>
                  <th className="text-right px-4 py-3 text-white/40 font-semibold">Alerts Sent</th>
                  <th className="text-right px-4 py-3 text-white/40 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody>
                {runs.map(r => (
                  <tr key={r.id} className="border-b border-white/5 hover:bg-white/3">
                    <td className="px-4 py-2.5 text-white/60">{new Date(r.run_at).toLocaleString()}</td>
                    <td className="px-4 py-2.5 text-white/60 capitalize hidden sm:table-cell">{r.source || "all"}</td>
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
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-white/8 bg-white/3">
                  <th className="text-left px-4 py-3 text-white/40 font-semibold">Name</th>
                  <th className="text-left px-4 py-3 text-white/40 font-semibold">License / Role</th>
                  <th className="text-left px-4 py-3 text-white/40 font-semibold">City</th>
                  <th className="text-left px-4 py-3 text-white/40 font-semibold hidden sm:table-cell">Source</th>
                  <th className="text-center px-4 py-3 text-white/40 font-semibold hidden sm:table-cell">Data %</th>
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
                      <td className="px-4 py-2.5 text-white font-medium">
                        {c.full_name}
                        {c.cross_referenced && (
                          <span className="ml-1.5 text-[10px] text-purple-400 font-bold">⚡ Cross-Ref</span>
                        )}
                        {c.phone_type === "mobile" && (
                          <span className="ml-1.5 text-[10px] text-emerald-400 font-bold">✅ Mobile</span>
                        )}
                        {c.phone_type === "landline" && (
                          <span className="ml-1.5 text-[10px] text-amber-400 font-bold">☎ Landline</span>
                        )}
                        {c.phone_type === "voip" && (
                          <span className="ml-1.5 text-[10px] text-sky-400 font-bold">📶 VoIP</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-white/60">{c.license_type || "—"}</td>
                      <td className="px-4 py-2.5 text-white/60">{c.city || "—"}</td>
                      <td className="px-4 py-2.5 text-white/60 capitalize hidden sm:table-cell">{c.source}</td>
                      <td className="px-4 py-2.5 hidden sm:table-cell">
                        <div className="flex items-center gap-2">
                          <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all"
                              style={{
                                width: `${c.data_completeness || 0}%`,
                                background: (c.data_completeness || 0) >= 80 ? "#10b981" : (c.data_completeness || 0) >= 40 ? "#f59e0b" : "#ef4444",
                              }}
                            />
                          </div>
                          <span className="text-[10px] text-white/40 font-mono">{c.data_completeness || 0}%</span>
                        </div>
                      </td>
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

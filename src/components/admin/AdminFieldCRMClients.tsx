import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  Plus, Copy, Check, Globe, Eye, Star, RefreshCw,
  Building2, Phone, Mail, ExternalLink, Pencil, Trash2,
  Code2, DollarSign, Users,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface FieldCRMClient {
  id: string;
  business_name: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  industry: string;
  website: string | null;
  visitor_script_key: string;
  google_review_url: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: string;
  plan: string;
  monthly_price: number;
  created_at: string;
  visitor_count?: number;
  leads_created?: number;
}

// ── Snippet Generator ──────────────────────────────────────────────────────────

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://zmyczlfuufhngzovkjdh.supabase.co";

function buildSnippet(scriptKey: string): string {
  return `<!-- M² Field CRM by Detroit Web Agency -->
<script>
(function(){
  var d={page:window.location.href,ref:document.referrer,key:"${scriptKey}"};
  fetch("${SUPABASE_URL}/functions/v1/visitor-identify",{
    method:"POST",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({script_key:d.key,page:d.page,referrer:d.ref})
  });
})();
</script>`;
}

// ── Copy Button ────────────────────────────────────────────────────────────────

function CopyButton({ text, label = "Copy" }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={copy}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
      style={{
        background: copied ? "#10b98120" : "#ffffff10",
        color: copied ? "#10b981" : "rgba(255,255,255,0.6)",
        border: `1px solid ${copied ? "#10b98140" : "rgba(255,255,255,0.1)"}`,
      }}>
      {copied ? <Check size={11} /> : <Copy size={11} />}
      {copied ? "Copied!" : label}
    </button>
  );
}

// ── Snippet Modal ──────────────────────────────────────────────────────────────

function SnippetModal({ client, onClose }: { client: FieldCRMClient; onClose: () => void }) {
  const snippet = buildSnippet(client.visitor_script_key);
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-[#0a0f1e] border border-white/10 rounded-2xl p-6 max-w-2xl w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className="text-white font-black text-lg">{client.business_name}</h3>
            <p className="text-white/40 text-sm mt-0.5">Visitor tracking snippet — paste before &lt;/body&gt;</p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl leading-none">✕</button>
        </div>

        {/* Instructions */}
        <div className="rounded-xl bg-blue-500/8 border border-blue-500/20 p-4 mb-4 text-sm text-blue-300">
          <p className="font-semibold mb-1">📋 Installation (2 minutes)</p>
          <ol className="list-decimal list-inside space-y-1 text-blue-300/80 text-xs">
            <li>Copy the snippet below</li>
            <li>Open their website editor (WordPress → Appearance → Theme Editor → footer.php, OR any "Header/Footer" plugin)</li>
            <li>Paste just before the closing <code className="text-blue-200">&lt;/body&gt;</code> tag</li>
            <li>Save. Done. Visitors start showing up in the Visitor Intel tab immediately.</li>
          </ol>
        </div>

        {/* Snippet */}
        <div className="relative">
          <pre className="bg-black/60 border border-white/8 rounded-xl p-4 text-xs text-emerald-300 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed mb-3">
            {snippet}
          </pre>
          <div className="absolute top-3 right-3">
            <CopyButton text={snippet} label="Copy Snippet" />
          </div>
        </div>

        {/* Script key */}
        <div className="flex items-center gap-2 mt-3 text-xs text-white/30">
          <Code2 size={11} />
          <span>Script key: <code className="text-white/50 font-mono">{client.visitor_script_key}</code></span>
          <CopyButton text={client.visitor_script_key} label="Copy Key" />
        </div>
      </div>
    </div>
  );
}

// ── Add / Edit Client Modal ────────────────────────────────────────────────────

function ClientModal({ existing, onClose, onSaved }: {
  existing?: FieldCRMClient; onClose: () => void; onSaved: () => void;
}) {
  const [form, setForm] = useState({
    business_name: existing?.business_name ?? "",
    owner_name: existing?.owner_name ?? "",
    phone: existing?.phone ?? "",
    email: existing?.email ?? "",
    industry: existing?.industry ?? "hvac",
    website: existing?.website ?? "",
    google_review_url: existing?.google_review_url ?? "",
    plan: existing?.plan ?? "standard",
    monthly_price: existing?.monthly_price ?? 19900,
    status: existing?.status ?? "active",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form, v: string | number) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    if (!form.business_name.trim()) { toast.error("Business name required"); return; }
    setSaving(true);
    const payload = { ...form, monthly_price: Number(form.monthly_price) };
    const { error } = existing
      ? await (supabase as any).from("field_crm_clients").update(payload).eq("id", existing.id)
      : await (supabase as any).from("field_crm_clients").insert(payload);
    setSaving(false);
    if (error) { toast.error("Save failed: " + error.message); return; }
    toast.success(existing ? "Client updated" : `${form.business_name} added!`);
    onSaved();
    onClose();
  };

  const label = "text-white/50 text-xs mb-1 block";
  const inp = "bg-white/5 border-white/10 text-white placeholder:text-white/25 text-sm";

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}>
      <div className="bg-[#0a0f1e] border border-white/10 rounded-2xl p-6 max-w-lg w-full shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-black text-lg">{existing ? "Edit Client" : "Add Field CRM Client"}</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className={label}>Business Name *</label>
              <Input value={form.business_name} onChange={(e) => set("business_name", e.target.value)}
                placeholder="D.J. Conley Boiler Solutions" className={inp} />
            </div>
            <div>
              <label className={label}>Owner Name</label>
              <Input value={form.owner_name} onChange={(e) => set("owner_name", e.target.value)}
                placeholder="Pat Michels" className={inp} />
            </div>
            <div>
              <label className={label}>Industry</label>
              <select value={form.industry} onChange={(e) => set("industry", e.target.value)}
                className="w-full h-10 rounded-md border border-white/10 bg-white/5 text-white text-sm px-3">
                <option value="hvac">HVAC</option>
                <option value="plumbing">Plumbing</option>
                <option value="electrical">Electrical</option>
                <option value="roofing">Roofing</option>
                <option value="boiler">Boiler Service</option>
                <option value="general_contractor">General Contractor</option>
                <option value="landscaping">Landscaping</option>
                <option value="other">Other</option>
              </select>
            </div>
            <div>
              <label className={label}>Phone</label>
              <Input value={form.phone} onChange={(e) => set("phone", e.target.value)}
                placeholder="(313) 555-0100" className={inp} />
            </div>
            <div>
              <label className={label}>Email</label>
              <Input value={form.email} onChange={(e) => set("email", e.target.value)}
                placeholder="pat@djconley.com" className={inp} />
            </div>
            <div>
              <label className={label}>Website</label>
              <Input value={form.website} onChange={(e) => set("website", e.target.value)}
                placeholder="https://djconley.com" className={inp} />
            </div>
            <div>
              <label className={label}>Google Review URL</label>
              <Input value={form.google_review_url} onChange={(e) => set("google_review_url", e.target.value)}
                placeholder="https://g.page/r/..." className={inp} />
            </div>
            <div>
              <label className={label}>Plan</label>
              <select value={form.plan} onChange={(e) => set("plan", e.target.value)}
                className="w-full h-10 rounded-md border border-white/10 bg-white/5 text-white text-sm px-3">
                <option value="standard">Standard ($199/mo)</option>
                <option value="pro">Pro ($299/mo)</option>
                <option value="demo">Demo (Free)</option>
              </select>
            </div>
            <div>
              <label className={label}>Monthly Price (cents)</label>
              <Input type="number" value={form.monthly_price} onChange={(e) => set("monthly_price", e.target.value)}
                placeholder="19900" className={inp} />
            </div>
            <div>
              <label className={label}>Status</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)}
                className="w-full h-10 rounded-md border border-white/10 bg-white/5 text-white text-sm px-3">
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
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

function ClientCard({ client, onSnippet, onEdit, onDelete }: {
  client: FieldCRMClient;
  onSnippet: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const statusColor: Record<string, string> = {
    active: "#10b981", trial: "#f59e0b", paused: "#6b7280", cancelled: "#ef4444",
  };
  const color = statusColor[client.status] || "#6b7280";

  return (
    <motion.div layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-white/8 bg-white/3 p-5 hover:border-white/15 transition-all">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-white font-black text-sm truncate">{client.business_name}</h3>
            <Badge className="text-[10px] py-0 shrink-0 capitalize"
              style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}>
              {client.status}
            </Badge>
          </div>
          {client.owner_name && <p className="text-white/40 text-xs mt-0.5">{client.owner_name}</p>}
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

      {/* Meta */}
      <div className="space-y-1.5 mb-4">
        {client.industry && (
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Building2 size={11} />
            <span className="capitalize">{client.industry.replace("_", " ")}</span>
          </div>
        )}
        {client.phone && (
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Phone size={11} />
            <a href={`tel:${client.phone}`} className="hover:text-white transition-colors">{client.phone}</a>
          </div>
        )}
        {client.email && (
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Mail size={11} />
            <a href={`mailto:${client.email}`} className="hover:text-white transition-colors truncate">{client.email}</a>
          </div>
        )}
        {client.website && (
          <div className="flex items-center gap-2 text-xs text-white/40">
            <Globe size={11} />
            <a href={client.website} target="_blank" rel="noopener noreferrer"
              className="hover:text-white transition-colors truncate flex items-center gap-1">
              {client.website.replace(/^https?:\/\//, "")}
              <ExternalLink size={9} />
            </a>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg bg-white/4 p-2 text-center">
          <div className="text-white font-bold text-sm">{client.visitor_count ?? 0}</div>
          <div className="text-white/35 text-[10px]">Visitors</div>
        </div>
        <div className="rounded-lg bg-white/4 p-2 text-center">
          <div className="text-emerald-400 font-bold text-sm">{client.leads_created ?? 0}</div>
          <div className="text-white/35 text-[10px]">Leads ID'd</div>
        </div>
        <div className="rounded-lg bg-white/4 p-2 text-center">
          <div className="text-orange-400 font-bold text-sm">${(client.monthly_price / 100).toFixed(0)}</div>
          <div className="text-white/35 text-[10px]">/mo</div>
        </div>
      </div>

      {/* Review URL status */}
      <div className={`flex items-center gap-1.5 text-[10px] mb-3 ${client.google_review_url ? "text-emerald-400" : "text-amber-400/70"}`}>
        <Star size={10} />
        {client.google_review_url ? "Google review URL configured" : "⚠ No Google review URL yet"}
      </div>

      {/* Actions */}
      <button onClick={onSnippet}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-xs font-bold transition-all"
        style={{ background: "linear-gradient(135deg, #e8621a20, #a855f720)", border: "1px solid rgba(232,98,26,0.3)", color: "#e8621a" }}>
        <Code2 size={13} />
        Get Tracking Snippet
      </button>
    </motion.div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminFieldCRMClients() {
  const [clients, setClients] = useState<FieldCRMClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [snippetClient, setSnippetClient] = useState<FieldCRMClient | null>(null);
  const [editClient, setEditClient] = useState<FieldCRMClient | undefined>(undefined);
  const [showAdd, setShowAdd] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("field_crm_clients")
      .select("*")
      .order("created_at", { ascending: false });

    if (!data) { setLoading(false); return; }

    // Enrich with visitor counts
    const enriched = await Promise.all(
      (data as FieldCRMClient[]).map(async (c) => {
        const [{ count: vc }, { count: lc }] = await Promise.all([
          (supabase as any).from("crm_visitor_events").select("id", { count: "exact", head: true }).eq("client_id", c.id),
          (supabase as any).from("crm_visitor_events").select("id", { count: "exact", head: true }).eq("client_id", c.id).eq("lead_auto_created", true),
        ]);
        return { ...c, visitor_count: vc || 0, leads_created: lc || 0 };
      })
    );
    setClients(enriched);
    setLoading(false);
  };

  const deleteClient = async (id: string, name: string) => {
    if (!confirm(`Remove ${name} from Field CRM? This will delete all their visitor data.`)) return;
    await (supabase as any).from("field_crm_clients").delete().eq("id", id);
    toast.success(`${name} removed`);
    load();
  };

  useEffect(() => { load(); }, []);

  const activeClients = clients.filter((c) => c.status === "active");
  const totalMRR = clients.filter((c) => c.status === "active").reduce((s, c) => s + c.monthly_price, 0);
  const totalVisitors = clients.reduce((s, c) => s + (c.visitor_count || 0), 0);

  return (
    <div className="space-y-6 p-1">
      {snippetClient && <SnippetModal client={snippetClient} onClose={() => setSnippetClient(null)} />}
      {showAdd && <ClientModal onClose={() => setShowAdd(false)} onSaved={load} />}
      {editClient && <ClientModal existing={editClient} onClose={() => setEditClient(undefined)} onSaved={load} />}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h2 className="text-white text-xl font-black flex items-center gap-2">
            <Building2 size={20} className="text-orange-400" />
            Field CRM Clients
          </h2>
          <p className="text-white/40 text-sm mt-0.5">
            Manage subscribers and generate their tracking snippets.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}
            className="border-white/15 text-white/60 hover:text-white">
            <RefreshCw size={13} className="mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)}
            className="bg-orange-500 hover:bg-orange-600 text-white">
            <Plus size={13} className="mr-1" /> Add Client
          </Button>
        </div>
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { icon: Users, label: "Active Clients", value: activeClients.length, color: "#10b981" },
          { icon: DollarSign, label: "Monthly Revenue", value: `$${(totalMRR / 100).toLocaleString()}`, color: "#e8621a" },
          { icon: Eye, label: "Total Visitors Tracked", value: totalVisitors.toLocaleString(), color: "#3b82f6" },
        ].map(({ icon: Icon, label, value, color }) => (
          <div key={label} className="rounded-2xl border p-4" style={{ background: `${color}0d`, borderColor: `${color}25` }}>
            <Icon size={16} style={{ color }} className="mb-2" />
            <div className="text-2xl font-black text-white">{value}</div>
            <div className="text-xs font-semibold mt-0.5" style={{ color }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Client grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
        </div>
      ) : clients.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/10 p-16 text-center">
          <Building2 size={40} className="text-white/15 mx-auto mb-4" />
          <p className="text-white/40 text-sm">No clients yet.</p>
          <p className="text-white/25 text-xs mt-1">Add your first Field CRM client to generate their tracking snippet.</p>
          <Button onClick={() => setShowAdd(true)} className="mt-5 bg-orange-500 hover:bg-orange-600 text-white">
            <Plus size={14} className="mr-1.5" /> Add First Client
          </Button>
        </div>
      ) : (
        <AnimatePresence>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {clients.map((c) => (
              <ClientCard
                key={c.id}
                client={c}
                onSnippet={() => setSnippetClient(c)}
                onEdit={() => setEditClient(c)}
                onDelete={() => deleteClient(c.id, c.business_name)}
              />
            ))}
          </div>
        </AnimatePresence>
      )}

      {/* How it works */}
      <div className="rounded-2xl border border-white/8 bg-white/2 p-5">
        <p className="text-white/60 text-xs font-bold uppercase tracking-wider mb-3">How the Snippet Works</p>
        <div className="grid sm:grid-cols-3 gap-4 text-xs text-white/50">
          <div>
            <p className="text-white font-semibold mb-1">1. Client Purchases</p>
            <p>They sign up via Stripe. A client row is auto-created with a unique script key. They get a welcome email with their snippet.</p>
          </div>
          <div>
            <p className="text-white font-semibold mb-1">2. Snippet Installed</p>
            <p>One script tag in their site footer (like Google Analytics). Works on WordPress, Squarespace, Wix — anything. Takes 2 minutes.</p>
          </div>
          <div>
            <p className="text-white font-semibold mb-1">3. Visitors Identified</p>
            <p>Every business visitor's IP is reverse-looked up. Company name + page visited appears in their Visitor Intel feed instantly.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

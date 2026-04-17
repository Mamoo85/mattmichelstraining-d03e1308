import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import {
  Plus, Copy, Check, Eye, RefreshCw, Building2, ExternalLink, Pencil, Trash2,
  Code2, Search,
} from "lucide-react";
import ConfirmActionModal from "@/components/shared/ConfirmActionModal";
import ClientBoardPreview from "@/components/dwa-admin/ClientBoardPreview";

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

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "https://eauvubfpanpeuxsrqesu.supabase.co";

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

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <Button size="sm" variant="outline" onClick={() => {
      navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success(`${label} copied`);
      setTimeout(() => setCopied(false), 2000);
    }}>
      {copied ? <Check size={12} className="mr-1" /> : <Copy size={12} className="mr-1" />}
      {copied ? "Copied" : label}
    </Button>
  );
}

function SnippetModal({ client, onClose, onJumpToVisitorIntel }: {
  client: FieldCRMClient; onClose: () => void; onJumpToVisitorIntel: () => void;
}) {
  const snippet = buildSnippet(client.visitor_script_key);
  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0a0f1e] border border-white/10 rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-white font-black text-lg">📋 Visitor Tracker Code — {client.business_name}</h3>
            <p className="text-white/50 text-sm mt-1">
              Paste this in their website footer (before <code className="text-blue-300">&lt;/body&gt;</code>).
              Then businesses that visit their site appear in the <strong>Visitor Intel</strong> tab.
            </p>
          </div>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl leading-none">✕</button>
        </div>

        <div className="rounded-xl bg-blue-500/8 border border-blue-500/20 p-4 mb-4 text-sm text-blue-300">
          <p className="font-semibold mb-1">What this does</p>
          <p className="text-blue-300/80 text-xs leading-relaxed">
            Identifies anonymous business visitors via IP reverse-lookup. Company name + page visited
            shows up in the Visitor Intel feed in real time. Works like Google Analytics — paste once, leave forever.
          </p>
        </div>

        <pre className="bg-black/60 border border-white/8 rounded-xl p-4 text-xs text-emerald-300 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed mb-3">
{snippet}
        </pre>

        <div className="flex flex-wrap gap-2">
          <CopyBtn text={snippet} label="Copy snippet" />
          <CopyBtn text={client.visitor_script_key} label="Copy key" />
          <Button size="sm" variant="outline" onClick={() => { onJumpToVisitorIntel(); onClose(); }}>
            <Eye size={12} className="mr-1" /> See results in Visitor Intel
          </Button>
        </div>
      </div>
    </div>
  );
}

function ClientFormModal({ existing, onClose, onSaved }: {
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
    toast.success(existing ? "Client updated" : `${form.business_name} added`);
    onSaved(); onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-[#0a0f1e] border border-white/10 rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-white font-black text-lg">{existing ? "Edit Client" : "Add FieldDesk Client"}</h3>
          <button onClick={onClose} className="text-white/30 hover:text-white text-xl leading-none">✕</button>
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="text-white/50 text-xs mb-1 block">Business Name *</label>
              <Input value={form.business_name} onChange={(e) => set("business_name", e.target.value)} className="bg-white/5 border-white/10" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">Owner Name</label>
              <Input value={form.owner_name} onChange={(e) => set("owner_name", e.target.value)} className="bg-white/5 border-white/10" />
            </div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">Industry</label>
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
            <div><label className="text-white/50 text-xs mb-1 block">Phone</label><Input value={form.phone} onChange={(e) => set("phone", e.target.value)} className="bg-white/5 border-white/10" /></div>
            <div><label className="text-white/50 text-xs mb-1 block">Email</label><Input value={form.email} onChange={(e) => set("email", e.target.value)} className="bg-white/5 border-white/10" /></div>
            <div><label className="text-white/50 text-xs mb-1 block">Website</label><Input value={form.website} onChange={(e) => set("website", e.target.value)} className="bg-white/5 border-white/10" /></div>
            <div><label className="text-white/50 text-xs mb-1 block">Google Review URL</label><Input value={form.google_review_url} onChange={(e) => set("google_review_url", e.target.value)} className="bg-white/5 border-white/10" /></div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">Plan</label>
              <select value={form.plan} onChange={(e) => set("plan", e.target.value)} className="w-full h-10 rounded-md border border-white/10 bg-white/5 text-white text-sm px-3">
                <option value="standard">Standard ($199/mo)</option>
                <option value="pro">Pro ($299/mo)</option>
                <option value="demo">Demo (Free)</option>
              </select>
            </div>
            <div><label className="text-white/50 text-xs mb-1 block">Monthly Price (cents)</label><Input type="number" value={form.monthly_price} onChange={(e) => set("monthly_price", e.target.value)} className="bg-white/5 border-white/10" /></div>
            <div>
              <label className="text-white/50 text-xs mb-1 block">Status</label>
              <select value={form.status} onChange={(e) => set("status", e.target.value)} className="w-full h-10 rounded-md border border-white/10 bg-white/5 text-white text-sm px-3">
                <option value="active">Active</option>
                <option value="trial">Trial</option>
                <option value="paused">Paused</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-5">
          <Button onClick={save} disabled={saving} className="bg-orange-500 hover:bg-orange-600 text-white flex-1">
            {saving ? "Saving…" : existing ? "Save Changes" : "Add Client"}
          </Button>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
        </div>
      </div>
    </div>
  );
}

const STATUS_VARIANT: Record<string, { bg: string; color: string }> = {
  active:    { bg: "bg-emerald-500/15",  color: "text-emerald-400" },
  trial:     { bg: "bg-amber-500/15",    color: "text-amber-400" },
  paused:    { bg: "bg-slate-500/15",    color: "text-slate-400" },
  cancelled: { bg: "bg-red-500/15",      color: "text-red-400" },
};

export default function AdminFieldCRMClients() {
  const [clients, setClients] = useState<FieldCRMClient[]>([]);
  const [loading, setLoading] = useState(true);
  const [snippetClient, setSnippetClient] = useState<FieldCRMClient | null>(null);
  const [previewClient, setPreviewClient] = useState<FieldCRMClient | null>(null);
  const [editClient, setEditClient] = useState<FieldCRMClient | undefined>(undefined);
  const [showAdd, setShowAdd] = useState(false);
  const [search, setSearch] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<FieldCRMClient | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("field_crm_clients")
      .select("*")
      .order("created_at", { ascending: false });
    if (!data) { setLoading(false); return; }
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

  useEffect(() => { load(); }, []);

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    const { error } = await (supabase as any).from("field_crm_clients").delete().eq("id", confirmDelete.id);
    setDeleting(false);
    if (error) { toast.error("Delete failed: " + error.message); return; }
    toast.success(`${confirmDelete.business_name} removed`);
    setConfirmDelete(null);
    load();
  };

  const filtered = clients.filter((c) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return c.business_name.toLowerCase().includes(q)
      || c.owner_name?.toLowerCase().includes(q)
      || c.email?.toLowerCase().includes(q)
      || c.industry?.toLowerCase().includes(q);
  });

  const totalMRR = clients.filter((c) => c.status === "active").reduce((s, c) => s + c.monthly_price, 0);
  const activeCount = clients.filter((c) => c.status === "active").length;
  const totalVisitors = clients.reduce((s, c) => s + (c.visitor_count || 0), 0);

  return (
    <div className="space-y-4">
      {snippetClient && (
        <SnippetModal
          client={snippetClient}
          onClose={() => setSnippetClient(null)}
          onJumpToVisitorIntel={() => {
            // Best-effort jump — admin sidebar handles this; for now just toast
            toast.info("Open the Visitor Intel tab in the sidebar to see live results.");
          }}
        />
      )}
      {showAdd && <ClientFormModal onClose={() => setShowAdd(false)} onSaved={load} />}
      {editClient && <ClientFormModal existing={editClient} onClose={() => setEditClient(undefined)} onSaved={load} />}
      <ClientBoardPreview open={!!previewClient} onOpenChange={(o) => !o && setPreviewClient(null)} client={previewClient} />
      <ConfirmActionModal
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title="Remove FieldDesk client?"
        description={confirmDelete ? `This permanently deletes ${confirmDelete.business_name} and all their visitor tracking data. Their Stripe subscription is NOT cancelled — do that separately if needed.` : ""}
        confirmLabel="Delete client"
        loading={deleting}
        destructive
        onConfirm={handleDelete}
      />

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-white text-xl font-black flex items-center gap-2">
            <Building2 size={20} className="text-orange-400" />
            FieldDesk Clients
          </h2>
          <p className="text-white/40 text-sm mt-0.5">Compact roster — click any row to preview their Board.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={load}>
            <RefreshCw size={13} className="mr-1" /> Refresh
          </Button>
          <Button size="sm" onClick={() => setShowAdd(true)} className="bg-orange-500 hover:bg-orange-600 text-white">
            <Plus size={13} className="mr-1" /> Add Client
          </Button>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3">
          <div className="text-2xl font-black text-white">{activeCount}</div>
          <div className="text-xs text-emerald-400 font-semibold">Active Clients</div>
        </div>
        <div className="rounded-xl border border-orange-500/20 bg-orange-500/5 p-3">
          <div className="text-2xl font-black text-white">${(totalMRR / 100).toLocaleString()}</div>
          <div className="text-xs text-orange-400 font-semibold">Monthly Revenue</div>
        </div>
        <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-3">
          <div className="text-2xl font-black text-white">{totalVisitors.toLocaleString()}</div>
          <div className="text-xs text-blue-400 font-semibold">Visitors Tracked</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by business, owner, email, industry…"
          className="pl-9 bg-white/5 border-white/10"
        />
      </div>

      {/* Table */}
      <div className="rounded-xl border border-white/10 bg-white/2 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-white/10 hover:bg-transparent">
              <TableHead className="text-white/50">Business</TableHead>
              <TableHead className="text-white/50">Industry</TableHead>
              <TableHead className="text-white/50">Contact</TableHead>
              <TableHead className="text-white/50 text-right">Visitors</TableHead>
              <TableHead className="text-white/50 text-right">MRR</TableHead>
              <TableHead className="text-white/50">Status</TableHead>
              <TableHead className="text-white/50 text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && (
              <TableRow><TableCell colSpan={7} className="text-center text-white/40 py-8">Loading…</TableCell></TableRow>
            )}
            {!loading && !filtered.length && (
              <TableRow><TableCell colSpan={7} className="text-center text-white/40 py-8">
                {clients.length === 0 ? "No clients yet — click Add Client." : "No matches for that search."}
              </TableCell></TableRow>
            )}
            {filtered.map((c) => {
              const sv = STATUS_VARIANT[c.status] || STATUS_VARIANT.paused;
              return (
                <TableRow key={c.id} className="border-white/10 hover:bg-white/5 cursor-pointer" onClick={() => setPreviewClient(c)}>
                  <TableCell className="font-semibold text-white">
                    <div className="flex flex-col">
                      <span>{c.business_name}</span>
                      {c.owner_name && <span className="text-xs text-white/40 font-normal">{c.owner_name}</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-white/60 capitalize text-xs">{c.industry?.replace(/_/g, " ") || "—"}</TableCell>
                  <TableCell className="text-white/60 text-xs">
                    {c.phone && <div className="font-mono">{c.phone}</div>}
                    {c.email && <div className="truncate max-w-[180px]">{c.email}</div>}
                  </TableCell>
                  <TableCell className="text-right text-white font-semibold">{c.visitor_count ?? 0}</TableCell>
                  <TableCell className="text-right text-orange-400 font-semibold">${(c.monthly_price / 100).toFixed(0)}</TableCell>
                  <TableCell>
                    <Badge className={`${sv.bg} ${sv.color} border-transparent capitalize text-[10px]`}>{c.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => setPreviewClient(c)} title="View as customer" className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-[#00d4ff]">
                        <Eye size={13} />
                      </button>
                      <button onClick={() => setSnippetClient(c)} title="Copy visitor tracker code" className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-emerald-400">
                        <Code2 size={13} />
                      </button>
                      {c.website && (
                        <a href={c.website} target="_blank" rel="noreferrer" title="Open their website" className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white">
                          <ExternalLink size={13} />
                        </a>
                      )}
                      <button onClick={() => setEditClient(c)} title="Edit" className="p-1.5 rounded hover:bg-white/10 text-white/50 hover:text-white">
                        <Pencil size={13} />
                      </button>
                      <button onClick={() => setConfirmDelete(c)} title="Delete" className="p-1.5 rounded hover:bg-red-500/15 text-white/50 hover:text-red-400">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

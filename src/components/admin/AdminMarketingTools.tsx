import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/hooks/use-toast";
import {
  Mail, MessageSquare, Eye, Star, ShieldAlert, ShieldCheck,
  RotateCw, Plus, Trash2, ExternalLink, GripVertical, Send,
} from "lucide-react";

// --------- Marketing tile config (status pulled live) ---------
type MarketingTile = {
  key: "site_radar" | "email_blasts" | "sms_center" | "reviews";
  label: string;
  icon: any;
  color: string;
  countTable: string;
  countLabel: string;
};

const TILES: MarketingTile[] = [
  { key: "site_radar",   label: "SiteRadar",      icon: Eye,           color: "#00d4ff", countTable: "crm_visitor_events",   countLabel: "visits / 24h" },
  { key: "email_blasts", label: "Email Campaigns", icon: Mail,          color: "#22c55e", countTable: "email_send_log",       countLabel: "sent / 24h" },
  { key: "sms_center",   label: "SMS Center",      icon: MessageSquare, color: "#f97316", countTable: "sms_send_log",         countLabel: "sent / 24h" },
  { key: "reviews",      label: "Reviews",         icon: Star,          color: "#eab308", countTable: "google_review_requests", countLabel: "requests / 7d" },
];

// =========================================================================
export default function AdminMarketingTools() {
  return (
    <div className="space-y-6">
      <KillSwitchCard />
      <MarketingTilesGrid />
      <CommandCenterTabs />
      <PitchAuditLog />
    </div>
  );
}

// =========================================================================
// 1. Master Kill Switch
// =========================================================================
function KillSwitchCard() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    const { data } = await supabase
      .from("marketing_kill_switch" as any)
      .select("enabled, reason")
      .eq("id", 1)
      .maybeSingle();
    setEnabled(!!(data as any)?.enabled);
    setReason((data as any)?.reason || "");
  }
  useEffect(() => { load(); }, []);

  async function toggle(next: boolean) {
    setSaving(true);
    const { error } = await supabase
      .from("marketing_kill_switch" as any)
      .update({ enabled: next, reason: next ? (reason || "Manual toggle") : null, toggled_at: new Date().toISOString(), toggled_by: "admin" })
      .eq("id", 1);
    setSaving(false);
    if (error) { toast({ title: "Failed", description: error.message, variant: "destructive" }); return; }
    setEnabled(next);
    toast({ title: next ? "🛑 Marketing BLOCKED" : "✅ Marketing ENABLED", description: next ? "All blast emails + outreach SMS paused." : "Sends will resume." });
  }

  return (
    <Card className={enabled ? "border-destructive/60 bg-destructive/5" : "border-green-600/40"}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          {enabled ? <ShieldAlert className="text-destructive" /> : <ShieldCheck className="text-green-500" />}
          Marketing Master Kill Switch
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          When ON, blocks every marketing email blast + outreach SMS (TechAlert, drips, pitch emails, follow-ups).
          Auth emails, receipts, and customer-facing transactional sends are NOT affected.
        </p>
        <Input
          placeholder="Reason (optional, shown in audit)"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          className="text-xs"
        />
        <div className="flex gap-2">
          <Button
            size="sm"
            variant={enabled ? "outline" : "destructive"}
            disabled={saving || enabled === null || enabled === true}
            onClick={() => toggle(true)}
          >
            🛑 Block all marketing
          </Button>
          <Button
            size="sm"
            variant={enabled ? "default" : "outline"}
            disabled={saving || enabled === null || enabled === false}
            onClick={() => toggle(false)}
            className={enabled ? "bg-green-600 hover:bg-green-700" : ""}
          >
            ✅ Resume marketing
          </Button>
          <Badge variant={enabled ? "destructive" : "secondary"} className="ml-auto self-center">
            Status: {enabled === null ? "…" : enabled ? "BLOCKED" : "LIVE"}
          </Badge>
        </div>
      </CardContent>
    </Card>
  );
}

// =========================================================================
// 2. Marketing Tiles (status indicators)
// =========================================================================
function MarketingTilesGrid() {
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    const since24 = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const since7 = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const next: Record<string, number> = {};
    for (const t of TILES) {
      const since = t.key === "reviews" ? since7 : since24;
      try {
        const { count } = await supabase
          .from(t.countTable as any)
          .select("*", { count: "exact", head: true })
          .gte("created_at", since);
        next[t.key] = count ?? 0;
      } catch { next[t.key] = 0; }
    }
    setCounts(next);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">📡 Marketing Tools — live status</CardTitle>
        <Button size="sm" variant="ghost" onClick={load}><RotateCw size={14} /></Button>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {TILES.map((t) => {
            const Icon = t.icon;
            const n = counts[t.key] ?? 0;
            const live = n > 0;
            return (
              <div
                key={t.key}
                className="rounded-xl p-4 border"
                style={{ background: `${t.color}10`, borderColor: `${t.color}40` }}
              >
                <div className="flex items-center justify-between mb-2">
                  <Icon size={20} style={{ color: t.color }} />
                  <span
                    className="w-2 h-2 rounded-full"
                    style={{ background: live ? "#22c55e" : "#737373", boxShadow: live ? "0 0 8px #22c55e" : "none" }}
                  />
                </div>
                <p className="font-bold text-sm" style={{ color: t.color }}>{t.label}</p>
                <p className="text-2xl font-black mt-1">{loading ? "…" : n.toLocaleString()}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{t.countLabel}</p>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// =========================================================================
// 3. Command Center Tabs Sync (paste raw URLs → auto-label)
// =========================================================================
type Tile = { id: string; label: string; url: string; sort_order: number; icon_emoji?: string | null };

function deriveLabel(url: string): { label: string; emoji: string } {
  try {
    const u = new URL(url.startsWith("http") ? url : `https://${url}`);
    const host = u.hostname.replace(/^www\./, "");
    const root = host.split(".")[0];
    const map: Record<string, string> = {
      eway: "🧾", fieldservio: "🛠️", quickbooks: "💰", gmail: "✉️",
      mail: "✉️", drive: "📁", calendar: "📅", slack: "💬",
      mitn: "📋", linkedin: "💼", facebook: "📘", instagram: "📸",
      stripe: "💳", twilio: "📞", supabase: "🗄️", github: "🐙",
    };
    return { label: root.charAt(0).toUpperCase() + root.slice(1), emoji: map[root] || "🔗" };
  } catch {
    return { label: url.slice(0, 40), emoji: "🔗" };
  }
}

function CommandCenterTabs() {
  const [tiles, setTiles] = useState<Tile[]>([]);
  const [pasteText, setPasteText] = useState("");
  const [loading, setLoading] = useState(true);
  const [owner] = useState("matt@detroitwebagent.com");

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("command_center_tiles" as any)
      .select("id, label, url, sort_order, icon_emoji")
      .eq("owner_email", owner)
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    setTiles((data as any) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function syncPaste() {
    const lines = pasteText.split("\n").map((l) => l.trim()).filter((l) => l && /[\w-]+\.[a-z]/i.test(l));
    if (!lines.length) { toast({ title: "No URLs found", variant: "destructive" }); return; }

    // Build inserts; preserve order user pasted in
    const startOrder = tiles.length;
    const rows = lines.map((raw, i) => {
      const { label, emoji } = deriveLabel(raw);
      const url = raw.startsWith("http") ? raw : `https://${raw}`;
      return { owner_email: owner, label, url, icon_emoji: emoji, sort_order: startOrder + i, is_active: true };
    });
    const { error } = await supabase.from("command_center_tiles" as any).insert(rows);
    if (error) { toast({ title: "Insert failed", description: error.message, variant: "destructive" }); return; }
    toast({ title: `✅ Added ${rows.length} tabs`, description: "Edit labels inline below." });
    setPasteText("");
    load();
  }

  async function updateTile(id: string, patch: Partial<Tile>) {
    await supabase.from("command_center_tiles" as any).update(patch).eq("id", id);
    setTiles((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }
  async function removeTile(id: string) {
    await supabase.from("command_center_tiles" as any).update({ is_active: false }).eq("id", id);
    setTiles((prev) => prev.filter((t) => t.id !== id));
  }
  async function move(id: string, dir: -1 | 1) {
    const idx = tiles.findIndex((t) => t.id === id);
    const swap = idx + dir;
    if (idx < 0 || swap < 0 || swap >= tiles.length) return;
    const a = tiles[idx], b = tiles[swap];
    await Promise.all([
      supabase.from("command_center_tiles" as any).update({ sort_order: b.sort_order }).eq("id", a.id),
      supabase.from("command_center_tiles" as any).update({ sort_order: a.sort_order }).eq("id", b.id),
    ]);
    load();
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">🎛️ My Command Center Tabs</CardTitle>
        <p className="text-xs text-muted-foreground">
          Paste your tab URLs (one per line). Labels + emojis auto-detected. Edit inline, reorder, or delete.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder={"https://eway.com\nhttps://fieldservio.com\nhttps://qbo.intuit.com\nhttps://mail.google.com\nmitn.info"}
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={5}
          className="font-mono text-xs"
        />
        <Button size="sm" onClick={syncPaste} disabled={!pasteText.trim()}>
          <Plus size={14} className="mr-1" /> Sync to Command Center
        </Button>

        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : tiles.length === 0 ? (
          <p className="text-xs text-muted-foreground">No tabs yet. Paste above to get started.</p>
        ) : (
          <div className="space-y-1.5">
            {tiles.map((t, i) => (
              <div key={t.id} className="flex items-center gap-2 p-2 rounded border border-border bg-card/50">
                <GripVertical size={14} className="text-muted-foreground shrink-0" />
                <Input
                  value={t.icon_emoji || ""}
                  onChange={(e) => updateTile(t.id, { icon_emoji: e.target.value })}
                  className="w-12 h-8 text-center"
                  maxLength={4}
                />
                <Input
                  value={t.label}
                  onChange={(e) => updateTile(t.id, { label: e.target.value })}
                  className="h-8 text-xs flex-1"
                />
                <a href={t.url} target="_blank" rel="noreferrer" className="text-[10px] text-muted-foreground truncate max-w-[180px] hover:text-foreground">
                  {t.url} <ExternalLink size={10} className="inline" />
                </a>
                <Button size="sm" variant="ghost" onClick={() => move(t.id, -1)} disabled={i === 0} className="h-7 w-7 p-0">↑</Button>
                <Button size="sm" variant="ghost" onClick={() => move(t.id, 1)} disabled={i === tiles.length - 1} className="h-7 w-7 p-0">↓</Button>
                <Button size="sm" variant="ghost" onClick={() => removeTile(t.id)} className="h-7 w-7 p-0 text-destructive">
                  <Trash2 size={14} />
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// =========================================================================
// 4. Pitch Audit Log — every send attempt + 1-click resend
// =========================================================================
type AuditRow = {
  id: string; template_name: string; recipient_email: string;
  status: string; error_message: string | null; triggered_by: string | null;
  metadata: any; created_at: string;
};

function PitchAuditLog() {
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [resending, setResending] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("pitch_send_audit" as any)
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100);
    setRows((data as any) || []);
    setLoading(false);
  }
  useEffect(() => { load(); }, []);

  async function resendPitch(recipient: string) {
    setResending(recipient);
    try {
      const { data, error } = await supabase.functions.invoke("send-djconley-pitch-v2", {
        body: { recipient_email: recipient, first_name: "Pat", triggered_by: "admin_resend", force: true },
      });
      if (error) throw error;
      if ((data as any)?.blocked) {
        toast({ title: "Blocked", description: "Kill switch is ON. Use force=true override (already enabled).", variant: "destructive" });
      } else {
        toast({ title: "✅ Resent", description: `Pitch resent to ${recipient}` });
      }
      load();
    } catch (e: any) {
      toast({ title: "Resend failed", description: e.message, variant: "destructive" });
    } finally {
      setResending(null);
    }
  }

  async function sendFollowupSms() {
    setResending("sms");
    try {
      const { data, error } = await supabase.functions.invoke("send-djconley-followup-sms", {
        body: { triggered_by: "admin_resend" },
      });
      if (error) throw error;
      if ((data as any)?.blocked) {
        toast({ title: "Blocked by kill switch", variant: "destructive" });
      } else if ((data as any)?.sent) {
        toast({ title: "📱 Follow-up SMS sent to Pat" });
      } else {
        toast({ title: "SMS error", description: (data as any)?.error || (data as any)?.skipped, variant: "destructive" });
      }
      load();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setResending(null);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">📋 Pitch Audit Log</CardTitle>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={sendFollowupSms} disabled={resending === "sms"}>
            <MessageSquare size={14} className="mr-1" /> Send Pat follow-up SMS
          </Button>
          <Button size="sm" variant="outline" onClick={() => resendPitch("pmichels@djconley.com")} disabled={resending === "pmichels@djconley.com"}>
            <Send size={14} className="mr-1" /> Resend pitch to Pat
          </Button>
          <Button size="sm" variant="ghost" onClick={load}><RotateCw size={14} /></Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-xs text-muted-foreground">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">No send attempts logged yet.</p>
        ) : (
          <div className="space-y-1.5">
            {rows.map((r) => (
              <div key={r.id} className="flex items-start justify-between gap-2 p-2 rounded border border-border bg-card/50 text-xs">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Badge
                      variant={r.status === "sent" ? "default" : r.status === "blocked" ? "secondary" : "destructive"}
                      className="text-[9px]"
                    >
                      {r.status}
                    </Badge>
                    <span className="font-mono text-[10px] text-muted-foreground">{r.template_name}</span>
                    {r.triggered_by && <span className="text-[9px] text-muted-foreground">· {r.triggered_by}</span>}
                  </div>
                  <p className="truncate">{r.recipient_email}</p>
                  {r.error_message && <p className="text-[10px] text-destructive mt-0.5 truncate">{r.error_message}</p>}
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[9px] text-muted-foreground">{new Date(r.created_at).toLocaleString()}</p>
                  {r.template_name === "djconley_pitch_v2" && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 text-[10px] mt-1"
                      onClick={() => resendPitch(r.recipient_email)}
                      disabled={resending === r.recipient_email}
                    >
                      <RotateCw size={10} className="mr-1" /> Resend
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

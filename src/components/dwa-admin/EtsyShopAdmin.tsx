import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type ShopInfo = {
  shop_name?: string;
  title?: string;
  announcement?: string;
  listing_active_count?: number;
  url?: string;
};

type Edit = {
  id: string;
  field: string;
  previous_value: string | null;
  new_value: string;
  pushed_ok: boolean;
  error_message: string | null;
  created_at: string;
};

type Sched = {
  id: string;
  kind: string;
  copy: string;
  starts_at: string;
  ends_at: string | null;
  priority: number;
  active: boolean;
};

type LogRow = { id: string; trigger: string; copy: string; pushed_ok: boolean; created_at: string };

const SECTION = "p-5 rounded-lg border border-white/10 bg-white/5";

export default function EtsyShopAdmin() {
  const [info, setInfo] = useState<ShopInfo | null>(null);
  const [title, setTitle] = useState("");
  const [ann, setAnn] = useState("");
  const [busy, setBusy] = useState(false);
  const [edits, setEdits] = useState<Edit[]>([]);
  const [scheds, setScheds] = useState<Sched[]>([]);
  const [logs, setLogs] = useState<LogRow[]>([]);
  const [automation, setAutomation] = useState(true);

  // Sale form
  const [saleCopy, setSaleCopy] = useState("");
  const [saleEnds, setSaleEnds] = useState("");

  async function load() {
    const [shopRes, editsRes, schedRes, logRes, autoRes] = await Promise.all([
      supabase.functions.invoke("etsy-shop-get"),
      supabase.from("etsy_shop_edits").select("*").order("created_at", { ascending: false }).limit(20),
      supabase.from("etsy_announcement_schedule").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("etsy_announcement_log").select("*").order("created_at", { ascending: false }).limit(15),
      supabase.from("site_content").select("content_value").eq("section","etsy_automation").eq("content_key","enabled").maybeSingle(),
    ]);
    if (shopRes.data?.ok) {
      setInfo(shopRes.data);
      setTitle(shopRes.data.title ?? "");
      setAnn(shopRes.data.announcement ?? "");
    } else if (shopRes.data?.error) {
      toast.error(`Etsy fetch failed: ${shopRes.data.error}`);
    }
    setEdits((editsRes.data as Edit[]) ?? []);
    setScheds((schedRes.data as Sched[]) ?? []);
    setLogs((logRes.data as LogRow[]) ?? []);
    setAutomation((autoRes.data?.content_value ?? "true") !== "false");
  }

  useEffect(() => { load(); }, []);

  async function push(fields: { title?: string; announcement?: string }) {
    setBusy(true);
    const u = await supabase.auth.getUser();
    const { data, error } = await supabase.functions.invoke("etsy-shop-update", {
      body: { ...fields, editor_id: u.data.user?.id, trigger: "admin_manual" },
    });
    setBusy(false);
    if (error || !data?.ok) { toast.error(`Push failed: ${data?.response ?? error?.message}`); return; }
    toast.success("Pushed to Etsy ✓");
    load();
  }

  async function toggleAutomation() {
    const next = !automation;
    await supabase.from("site_content").upsert(
      { section: "etsy_automation", content_key: "enabled", content_value: next ? "true" : "false" },
      { onConflict: "section,content_key" },
    );
    setAutomation(next);
    toast.success(`Automation ${next ? "enabled" : "paused"}`);
  }

  async function addSale() {
    if (!saleCopy.trim()) return;
    await supabase.from("etsy_announcement_schedule").insert({
      kind: "sale",
      copy: saleCopy.slice(0, 2200),
      ends_at: saleEnds ? new Date(saleEnds).toISOString() : null,
      priority: 100,
      active: true,
    });
    setSaleCopy(""); setSaleEnds("");
    toast.success("Sale queued");
    load();
  }

  async function toggleSched(id: string, active: boolean) {
    await supabase.from("etsy_announcement_schedule").update({ active: !active }).eq("id", id);
    load();
  }

  async function runRotator() {
    setBusy(true);
    const { data } = await supabase.functions.invoke("etsy-announcement-rotator");
    setBusy(false);
    toast.success(`Rotator: ${data?.picked ?? "done"}`);
    load();
  }

  const projectRef = (import.meta.env.VITE_SUPABASE_URL ?? "").split("//")[1]?.split(".")[0] ?? "";
  const connectUrl = `https://${projectRef}.functions.supabase.co/etsy-oauth-start?redirect_back=${encodeURIComponent(window.location.pathname)}`;
  const notConnected = !info && !busy;

  return (
    <div className="space-y-6 text-white">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold">Etsy Shop</h2>
          {info && (
            <p className="text-xs text-white/60 mt-1">
              {info.shop_name} · {info.listing_active_count} active listings ·{" "}
              <a href={info.url} target="_blank" rel="noreferrer" className="text-[#00d4ff] underline">view shop ↗</a>
            </p>
          )}
        </div>
        <div className="flex items-center gap-2">
          <a
            href={connectUrl}
            className="text-xs px-3 py-1.5 rounded font-semibold border border-[#00d4ff]/40 bg-[#00d4ff]/10 text-[#00d4ff] hover:bg-[#00d4ff]/20"
          >
            {info ? "Reconnect Etsy" : "Connect Etsy"}
          </a>
          <button
            onClick={toggleAutomation}
            className={`text-xs px-3 py-1.5 rounded font-semibold border ${automation ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300" : "border-amber-500/40 bg-amber-500/10 text-amber-300"}`}
          >
            Automation: {automation ? "ON" : "PAUSED"}
          </button>
        </div>
      </header>

      {notConnected && (
        <div className="p-4 rounded-lg border border-[#00d4ff]/30 bg-[#00d4ff]/5 text-sm">
          <p className="font-semibold text-[#00d4ff] mb-1">Etsy not connected</p>
          <p className="text-white/70">Click <b>Connect Etsy</b> above. You'll be sent to Etsy to approve access, then bounced back here. Tokens auto-refresh — one-time only.</p>
          <p className="text-white/40 text-xs mt-2">First time? Set this exact callback URL in your Etsy app: <code className="bg-black/30 px-1.5 py-0.5 rounded">https://{projectRef}.functions.supabase.co/etsy-oauth-callback</code></p>
        </div>
      )}


      {/* Live editor */}
      <div className={SECTION}>
        <h3 className="font-semibold mb-3">Live shop fields</h3>
        <div className="space-y-4">
          <div>
            <Label className="text-white/70">Shop title <span className="text-white/40 text-xs">({title.length}/55)</span></Label>
            <Input value={title} maxLength={55} onChange={(e) => setTitle(e.target.value)} className="bg-black/30 border-white/10 mt-1" />
            <Button size="sm" disabled={busy} onClick={() => push({ title })} className="mt-2">Push title</Button>
          </div>
          <div>
            <Label className="text-white/70">Announcement banner <span className="text-white/40 text-xs">({ann.length}/2200)</span></Label>
            <textarea
              value={ann}
              maxLength={2200}
              onChange={(e) => setAnn(e.target.value)}
              rows={4}
              className="w-full mt-1 rounded-md bg-black/30 border border-white/10 p-2 text-sm"
            />
            <Button size="sm" disabled={busy} onClick={() => push({ announcement: ann })} className="mt-2">Push announcement</Button>
          </div>
        </div>
      </div>

      {/* Schedule a sale */}
      <div className={SECTION}>
        <h3 className="font-semibold mb-3">Schedule sale / promo</h3>
        <div className="grid sm:grid-cols-[1fr,180px,120px] gap-3 items-end">
          <div>
            <Label className="text-white/70 text-xs">Announcement copy</Label>
            <Input value={saleCopy} onChange={(e) => setSaleCopy(e.target.value)} placeholder="🎉 20% off through Sunday — code SUMMER20" className="bg-black/30 border-white/10 mt-1" />
          </div>
          <div>
            <Label className="text-white/70 text-xs">Ends</Label>
            <Input type="datetime-local" value={saleEnds} onChange={(e) => setSaleEnds(e.target.value)} className="bg-black/30 border-white/10 mt-1" />
          </div>
          <Button onClick={addSale}>Queue sale</Button>
        </div>
      </div>

      {/* Queue */}
      <div className={SECTION}>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Announcement queue</h3>
          <Button size="sm" variant="outline" onClick={runRotator} disabled={busy}>Run rotator now</Button>
        </div>
        <div className="space-y-2 max-h-[360px] overflow-y-auto">
          {scheds.length === 0 && <p className="text-white/40 text-sm">Empty.</p>}
          {scheds.map((s) => (
            <div key={s.id} className="flex items-start gap-3 p-2 rounded bg-black/20">
              <span className={`text-[10px] uppercase font-bold px-1.5 py-0.5 rounded ${
                s.kind === "sale" ? "bg-rose-500/20 text-rose-300" :
                s.kind === "new_drop" ? "bg-emerald-500/20 text-emerald-300" :
                s.kind === "featured" ? "bg-amber-500/20 text-amber-300" :
                "bg-white/10 text-white/60"
              }`}>{s.kind}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{s.copy}</p>
                <p className="text-[10px] text-white/40 mt-0.5">
                  prio {s.priority}{s.ends_at ? ` · ends ${new Date(s.ends_at).toLocaleString()}` : ""}
                </p>
              </div>
              <button onClick={() => toggleSched(s.id, s.active)} className={`text-[10px] px-2 py-1 rounded ${s.active ? "bg-emerald-500/20 text-emerald-300" : "bg-white/10 text-white/40"}`}>
                {s.active ? "active" : "off"}
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Push log */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className={SECTION}>
          <h3 className="font-semibold mb-3">Recently pushed</h3>
          <div className="space-y-1.5 max-h-[280px] overflow-y-auto text-xs">
            {logs.length === 0 && <p className="text-white/40">Nothing pushed yet.</p>}
            {logs.map((l) => (
              <div key={l.id} className="p-2 rounded bg-black/20">
                <p className="truncate">{l.copy}</p>
                <p className="text-[10px] text-white/40 mt-0.5">
                  {l.trigger} · {new Date(l.created_at).toLocaleString()} {l.pushed_ok ? "✓" : "✗"}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div className={SECTION}>
          <h3 className="font-semibold mb-3">Edit history</h3>
          <div className="space-y-1.5 max-h-[280px] overflow-y-auto text-xs">
            {edits.length === 0 && <p className="text-white/40">No edits yet.</p>}
            {edits.map((e) => (
              <div key={e.id} className="p-2 rounded bg-black/20">
                <p><span className="text-white/40">{e.field}:</span> {e.new_value.slice(0, 100)}</p>
                <p className="text-[10px] text-white/40 mt-0.5">
                  {new Date(e.created_at).toLocaleString()} {e.pushed_ok ? "✓" : `✗ ${e.error_message ?? ""}`}
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Manual checklist */}
      <Card className="bg-amber-500/5 border-amber-500/30">
        <CardHeader><CardTitle className="text-amber-300 text-base">Manual-only on Etsy/Printify</CardTitle></CardHeader>
        <CardContent className="text-sm text-white/70 space-y-1.5">
          <p>• <b>Shop name</b> — Etsy dashboard → Settings → Info & appearance (one rename allowed)</p>
          <p>• <b>Banner image / icon</b> — Etsy dashboard → Shop Manager → Edit shop. Recommended: banner 3360×840, icon 500×500</p>
          <p>• <b>Printify store name + logo</b> — Printify dashboard → My Stores (not exposed via API)</p>
        </CardContent>
      </Card>
    </div>
  );
}

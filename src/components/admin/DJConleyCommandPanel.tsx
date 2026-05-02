import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Crown, Link2, Sparkles, ShieldCheck, Loader2, Grid3x3, Trash2, Plus } from "lucide-react";
import SendDJConleyProposalCard from "./SendDJConleyProposalCard";

/**
 * DJ Conley premium command panel.
 * - View / verify Pat's locked Forever Pricing record
 * - Send a magic-link login to Pat's owner dashboard
 * - Publish a "What's New" changelog entry visible inside Pat's portal
 * - Includes the post-meeting proposal sender card
 */
type PriceLock = {
  id: string;
  client_email: string;
  product: string | null;
  locked_monthly_price: number | null;
  notes: string | null;
  locked_since: string | null;
  active: boolean | null;
};

export default function DJConleyCommandPanel() {
  const [email, setEmail] = useState("pat@djconley.com");
  const [lock, setLock] = useState<PriceLock | null>(null);
  const [loadingLock, setLoadingLock] = useState(false);

  const [magicEmail, setMagicEmail] = useState("pat@djconley.com");
  const [sendingMagic, setSendingMagic] = useState(false);

  const [changelogTitle, setChangelogTitle] = useState("");
  const [changelogBody, setChangelogBody] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [sendingReport, setSendingReport] = useState(false);

  const sendWeeklyReport = async () => {
    setSendingReport(true);
    try {
      const { data, error } = await supabase.functions.invoke("djconley-weekly-value-report", { body: {} });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Weekly value report sent", {
        description: `Delivered to ${(data as any)?.sent ?? 0} of ${(data as any)?.total ?? 0} Forever-Pricing client(s).`,
      });
    } catch (err: any) {
      toast.error("Send failed", { description: err?.message || String(err) });
    } finally {
      setSendingReport(false);
    }
  };

  // Command Center tile manager
  const [tiles, setTiles] = useState<any[]>([]);
  const [loadingTiles, setLoadingTiles] = useState(false);
  const [newTile, setNewTile] = useState({ label: "", url: "", icon_emoji: "🔗", category: "general" });
  const [savingTile, setSavingTile] = useState(false);

  const loadTiles = async (target?: string) => {
    const e = (target ?? email).trim().toLowerCase();
    if (!e) return;
    setLoadingTiles(true);
    try {
      const { data, error } = await supabase
        .from("command_center_tiles" as any)
        .select("*")
        .eq("owner_email", e)
        .order("sort_order");
      if (error) throw error;
      setTiles((data as any) || []);
    } catch (err: any) {
      toast.error("Tiles load failed", { description: err?.message });
    } finally {
      setLoadingTiles(false);
    }
  };

  const addTile = async () => {
    if (!newTile.label.trim() || !newTile.url.trim()) return toast.error("Label + URL required");
    setSavingTile(true);
    try {
      const { error } = await supabase.from("command_center_tiles" as any).insert({
        owner_email: email.trim().toLowerCase(),
        label: newTile.label.trim(),
        url: newTile.url.trim(),
        icon_emoji: newTile.icon_emoji || "🔗",
        category: newTile.category || "general",
        sort_order: tiles.length,
        is_active: true,
      } as any);
      if (error) throw error;
      toast.success("Tile added");
      setNewTile({ label: "", url: "", icon_emoji: "🔗", category: "general" });
      await loadTiles();
    } catch (err: any) {
      toast.error("Add failed", { description: err?.message });
    } finally {
      setSavingTile(false);
    }
  };

  const deleteTile = async (id: string) => {
    try {
      const { error } = await supabase.from("command_center_tiles" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Tile removed");
      await loadTiles();
    } catch (err: any) {
      toast.error("Delete failed", { description: err?.message });
    }
  };

  // Command Center tile manager
  const [tiles, setTiles] = useState<any[]>([]);
  const [loadingTiles, setLoadingTiles] = useState(false);
  const [newTile, setNewTile] = useState({ label: "", url: "", icon_emoji: "🔗", category: "general" });
  const [savingTile, setSavingTile] = useState(false);

  const loadTiles = async (target?: string) => {
    const e = (target ?? email).trim().toLowerCase();
    if (!e) return;
    setLoadingTiles(true);
    try {
      const { data, error } = await supabase
        .from("command_center_tiles" as any)
        .select("*")
        .eq("owner_email", e)
        .order("sort_order");
      if (error) throw error;
      setTiles((data as any) || []);
    } catch (err: any) {
      toast.error("Tiles load failed", { description: err?.message });
    } finally {
      setLoadingTiles(false);
    }
  };

  const addTile = async () => {
    if (!newTile.label.trim() || !newTile.url.trim()) return toast.error("Label + URL required");
    setSavingTile(true);
    try {
      const { error } = await supabase.from("command_center_tiles" as any).insert({
        owner_email: email.trim().toLowerCase(),
        label: newTile.label.trim(),
        url: newTile.url.trim(),
        icon_emoji: newTile.icon_emoji || "🔗",
        category: newTile.category || "general",
        sort_order: tiles.length,
        is_active: true,
      } as any);
      if (error) throw error;
      toast.success("Tile added");
      setNewTile({ label: "", url: "", icon_emoji: "🔗", category: "general" });
      await loadTiles();
    } catch (err: any) {
      toast.error("Add failed", { description: err?.message });
    } finally {
      setSavingTile(false);
    }
  };

  const deleteTile = async (id: string) => {
    try {
      const { error } = await supabase.from("command_center_tiles" as any).delete().eq("id", id);
      if (error) throw error;
      toast.success("Tile removed");
      await loadTiles();
    } catch (err: any) {
      toast.error("Delete failed", { description: err?.message });
    }
  };

  const loadLock = async (target?: string) => {
    const e = (target ?? email).trim().toLowerCase();
    if (!e) return;
    setLoadingLock(true);
    try {
      const { data, error } = await supabase
        .from("client_price_locks" as any)
        .select("id, client_email, product, locked_monthly_price, notes, locked_since, active")
        .eq("client_email", e)
        .eq("active", true)
        .order("locked_since", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      setLock((data as any) || null);
    } catch (err: any) {
      toast.error("Lookup failed", { description: err?.message });
    } finally {
      setLoadingLock(false);
    }
  };

  useEffect(() => {
    loadLock("pat@djconley.com");
    loadTiles("pat@djconley.com");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sendMagicLink = async () => {
    if (!magicEmail.trim()) return toast.error("Email required");
    setSendingMagic(true);
    try {
      const { data, error } = await supabase.functions.invoke("owner-magic-link-request", {
        body: { email: magicEmail.trim().toLowerCase() },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Magic link sent", { description: `Sent to ${magicEmail}` });
    } catch (err: any) {
      toast.error("Magic link failed", { description: err?.message || String(err) });
    } finally {
      setSendingMagic(false);
    }
  };

  const publishChangelog = async () => {
    if (!changelogTitle.trim() || !changelogBody.trim()) {
      return toast.error("Title and body required");
    }
    setPublishing(true);
    try {
      const { error } = await supabase.from("product_changelog" as any).insert({
        product: "DJ Conley Premium",
        title: changelogTitle.trim(),
        body: changelogBody.trim(),
        ship_date: new Date().toISOString().slice(0, 10),
        is_public: true,
        tags: ["djconley", "forever-pricing"],
      } as any);
      if (error) throw error;
      toast.success("Changelog published", { description: "Pat will see it on next dashboard load." });
      setChangelogTitle("");
      setChangelogBody("");
    } catch (err: any) {
      toast.error("Publish failed", { description: err?.message });
    } finally {
      setPublishing(false);
    }
  };

  const dollars = lock?.locked_monthly_price != null ? `$${Number(lock.locked_monthly_price).toLocaleString()}/mo` : "—";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Crown className="h-6 w-6 text-[#00d4ff]" />
        <div>
          <h2 className="text-xl font-bold">D.J. Conley · Premium Command</h2>
          <p className="text-xs text-white/50">Forever Pricing · Owner Portal · Proposal · Changelog</p>
        </div>
      </div>

      <SendDJConleyProposalCard />

      {/* Forever Pricing lock viewer */}
      <Card className="border-[#00d4ff]/30 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="h-4 w-4 text-[#00d4ff]" />
            Forever Pricing — locked record
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="client email" />
            <Button onClick={() => loadLock()} variant="outline" disabled={loadingLock}>
              {loadingLock ? <Loader2 className="h-4 w-4 animate-spin" /> : "Lookup"}
            </Button>
          </div>

          {lock ? (
            <div className="rounded-md border border-[#00d4ff]/20 bg-[#00d4ff]/5 p-4 space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Badge className="bg-[#00d4ff] text-[#0a1628]">{lock.product || "product"}</Badge>
                <span className="font-bold text-lg">{dollars}</span>
                <span className="text-xs text-white/50">locked {lock.locked_since?.slice(0, 10)}</span>
              </div>
              <p className="text-xs text-white/70 italic">
                {lock.notes || "No carve-out clause stored."}
              </p>
            </div>
          ) : (
            <p className="text-sm text-white/50">
              No price lock found for this email. Will be created automatically on Stripe checkout success.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Magic link sender */}
      <Card className="border-white/10 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Link2 className="h-4 w-4 text-[#00d4ff]" />
            Send owner magic-link login
          </CardTitle>
          <p className="text-xs text-white/50">
            One-click access to Pat's premium owner dashboard (Forever Pricing badge, Command Center, What's New).
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Input value={magicEmail} onChange={(e) => setMagicEmail(e.target.value)} placeholder="pat@djconley.com" />
            <Button onClick={sendMagicLink} disabled={sendingMagic}>
              {sendingMagic ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send link"}
            </Button>
          </div>
          <p className="text-[11px] text-white/40">
            Link expires in 15 minutes. Lands at <code>/owner/verify</code>.
          </p>
        </CardContent>
      </Card>

      {/* Changelog publisher */}
      <Card className="border-white/10 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Sparkles className="h-4 w-4 text-[#00d4ff]" />
            Publish "What's New" entry
          </CardTitle>
          <p className="text-xs text-white/50">
            Appears in Pat's owner dashboard banner. Reinforces Forever Pricing value.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            value={changelogTitle}
            onChange={(e) => setChangelogTitle(e.target.value)}
            placeholder="e.g. New: AI-generated job follow-up SMS"
          />
          <Textarea
            value={changelogBody}
            onChange={(e) => setChangelogBody(e.target.value)}
            placeholder="One paragraph explaining the new value Pat just received."
            rows={4}
          />
          <Button onClick={publishChangelog} disabled={publishing} className="w-full">
            {publishing ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Publish to Pat's dashboard
          </Button>
          <div className="border-t border-white/10 pt-3 mt-3">
            <p className="text-xs text-white/60 mb-2">
              📧 <strong>Weekly Value Report</strong> — auto-sends every Monday 8am ET to all Forever-Pricing clients with this week's shipped features + new tiles.
            </p>
            <Button onClick={sendWeeklyReport} disabled={sendingReport} variant="outline" className="w-full border-[#00d4ff]/40">
              {sendingReport ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send weekly value report now
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Command Center tile manager */}
      <Card className="border-white/10 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Grid3x3 className="h-4 w-4 text-[#00d4ff]" />
            Command Center tiles ({tiles.length})
          </CardTitle>
          <p className="text-xs text-white/50">
            Quick links shown on Pat's owner dashboard (eWay, QuickBooks, Gmail, etc.). Owner: <code>{email}</code>
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingTiles ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <div className="space-y-2">
              {tiles.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 p-2 text-sm">
                  <span className="text-lg">{t.icon_emoji || "🔗"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t.label}</p>
                    <p className="text-[11px] text-white/40 truncate">{t.url}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
                  <Button size="icon" variant="ghost" onClick={() => deleteTile(t.id)}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              ))}
              {tiles.length === 0 && (
                <p className="text-xs text-white/40 italic">No tiles yet. Add Pat's most-used tools below.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 pt-2 border-t border-white/10">
            <Input
              value={newTile.icon_emoji}
              onChange={(e) => setNewTile({ ...newTile, icon_emoji: e.target.value })}
              placeholder="🔗"
              className="md:col-span-1"
            />
            <Input
              value={newTile.label}
              onChange={(e) => setNewTile({ ...newTile, label: e.target.value })}
              placeholder="Label (e.g. eWay)"
              className="md:col-span-1"
            />
            <Input
              value={newTile.url}
              onChange={(e) => setNewTile({ ...newTile, url: e.target.value })}
              placeholder="https://…"
              className="md:col-span-2"
            />
            <Button onClick={addTile} disabled={savingTile}>
              {savingTile ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />Add</>}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Command Center tile manager */}
      <Card className="border-white/10 bg-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Grid3x3 className="h-4 w-4 text-[#00d4ff]" />
            Command Center tiles ({tiles.length})
          </CardTitle>
          <p className="text-xs text-white/50">
            Quick links shown on Pat's owner dashboard (eWay, QuickBooks, Gmail, etc.). Owner: <code>{email}</code>
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          {loadingTiles ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <div className="space-y-2">
              {tiles.map((t) => (
                <div key={t.id} className="flex items-center gap-2 rounded-md border border-white/10 bg-white/5 p-2 text-sm">
                  <span className="text-lg">{t.icon_emoji || "🔗"}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{t.label}</p>
                    <p className="text-[11px] text-white/40 truncate">{t.url}</p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
                  <Button size="icon" variant="ghost" onClick={() => deleteTile(t.id)}>
                    <Trash2 className="h-4 w-4 text-red-400" />
                  </Button>
                </div>
              ))}
              {tiles.length === 0 && (
                <p className="text-xs text-white/40 italic">No tiles yet. Add Pat's most-used tools below.</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-5 gap-2 pt-2 border-t border-white/10">
            <Input
              value={newTile.icon_emoji}
              onChange={(e) => setNewTile({ ...newTile, icon_emoji: e.target.value })}
              placeholder="🔗"
              className="md:col-span-1"
            />
            <Input
              value={newTile.label}
              onChange={(e) => setNewTile({ ...newTile, label: e.target.value })}
              placeholder="Label (e.g. eWay)"
              className="md:col-span-1"
            />
            <Input
              value={newTile.url}
              onChange={(e) => setNewTile({ ...newTile, url: e.target.value })}
              placeholder="https://…"
              className="md:col-span-2"
            />
            <Button onClick={addTile} disabled={savingTile}>
              {savingTile ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" />Add</>}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

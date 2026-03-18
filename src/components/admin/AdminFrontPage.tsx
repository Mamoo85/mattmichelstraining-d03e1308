import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Save, Loader2, Megaphone } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";

const AdminFrontPage = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Banner
  const [bannerText, setBannerText] = useState("");
  const [bannerEnabled, setBannerEnabled] = useState(false);

  // Stats (4 pairs)
  const [stats, setStats] = useState([
    { value: "", label: "" },
    { value: "", label: "" },
    { value: "", label: "" },
    { value: "", label: "" },
  ]);

  useEffect(() => {
    loadContent();
  }, []);

  const loadContent = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("site_content")
      .select("content_key, content_value")
      .in("section", ["announcement", "homepage_stats"]);

    if (data) {
      const map: Record<string, string> = {};
      data.forEach((d: any) => { map[d.content_key] = d.content_value; });

      setBannerText(map["banner_text"] || "");
      setBannerEnabled(map["banner_enabled"] === "true");
      setStats([
        { value: map["stat_1_value"] || "", label: map["stat_1_label"] || "" },
        { value: map["stat_2_value"] || "", label: map["stat_2_label"] || "" },
        { value: map["stat_3_value"] || "", label: map["stat_3_label"] || "" },
        { value: map["stat_4_value"] || "", label: map["stat_4_label"] || "" },
      ]);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    const updates = [
      { section: "announcement", content_key: "banner_text", content_value: bannerText },
      { section: "announcement", content_key: "banner_enabled", content_value: bannerEnabled ? "true" : "false" },
      { section: "homepage_stats", content_key: "stat_1_value", content_value: stats[0].value },
      { section: "homepage_stats", content_key: "stat_1_label", content_value: stats[0].label },
      { section: "homepage_stats", content_key: "stat_2_value", content_value: stats[1].value },
      { section: "homepage_stats", content_key: "stat_2_label", content_value: stats[1].label },
      { section: "homepage_stats", content_key: "stat_3_value", content_value: stats[2].value },
      { section: "homepage_stats", content_key: "stat_3_label", content_value: stats[2].label },
      { section: "homepage_stats", content_key: "stat_4_value", content_value: stats[3].value },
      { section: "homepage_stats", content_key: "stat_4_label", content_value: stats[3].label },
    ];

    for (const u of updates) {
      await supabase
        .from("site_content")
        .update({ content_value: u.content_value })
        .eq("section", u.section)
        .eq("content_key", u.content_key);
    }

    toast({ title: "Front page updated" });
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Announcement Banner */}
      <div className="bg-card border border-border p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Megaphone size={14} className="text-primary" />
          <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Global Announcement Banner</h3>
        </div>
        <p className="text-[10px] text-muted-foreground">
          When enabled, a thin banner appears at the top of every page.
        </p>
        <div className="flex items-center gap-3">
          <Switch checked={bannerEnabled} onCheckedChange={setBannerEnabled} />
          <span className="text-xs font-bold text-foreground">{bannerEnabled ? "Banner ON" : "Banner OFF"}</span>
        </div>
        <Input
          value={bannerText}
          onChange={(e) => setBannerText(e.target.value)}
          placeholder="e.g. Winter Registration Now Open!"
          className="text-sm"
        />
        {bannerEnabled && bannerText && (
          <div className="bg-primary text-primary-foreground text-center py-2 text-xs font-bold uppercase tracking-widest">
            Preview: {bannerText}
          </div>
        )}
      </div>

      {/* Homepage Stats */}
      <div className="bg-card border border-border p-5 space-y-4">
        <h3 className="text-sm font-bold uppercase tracking-widest text-foreground">Homepage & About Stats</h3>
        <p className="text-[10px] text-muted-foreground">
          These numbers appear on the About page and can be referenced across the site.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.map((s, i) => (
            <div key={i} className="bg-muted p-3 space-y-2">
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">Stat {i + 1}</span>
              <Input
                value={s.value}
                onChange={(e) => {
                  const next = [...stats];
                  next[i] = { ...next[i], value: e.target.value };
                  setStats(next);
                }}
                placeholder="50+"
                className="font-mono"
              />
              <Input
                value={s.label}
                onChange={(e) => {
                  const next = [...stats];
                  next[i] = { ...next[i], label: e.target.value };
                  setStats(next);
                }}
                placeholder="College Athletes"
              />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={saving}
        className="flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 text-xs font-bold uppercase tracking-widest hover:opacity-90 disabled:opacity-50"
      >
        {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
        Save All Changes
      </button>
    </div>
  );
};

export default AdminFrontPage;

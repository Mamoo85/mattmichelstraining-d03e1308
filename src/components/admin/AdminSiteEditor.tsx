import { useState, useEffect } from "react";
import { Save, Eye, EyeOff, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  useSiteSections,
  useSiteContent,
  useInvalidateSiteContent,
  SiteSection,
  SiteContentItem,
} from "@/hooks/useSiteContent";

const SECTION_GROUPS = [
  { key: "all", label: "All" },
  { key: "landing", label: "Landing Page" },
  { key: "shop", label: "Shop" },
  { key: "pricing", label: "Pricing" },
  { key: "other", label: "Other" },
];

const LANDING_SECTIONS = [
  "hero", "authority_bar", "stats", "testimonial", "press",
  "audience_selector", "free_bonus", "current_clients", "guides",
  "premium_program", "online_services", "team_youth", "monthly_focus",
  "weekend_youth", "for_trainers", "can_fix_it", "why_m2", "matts_story",
  "merch", "find_us",
];

const AdminSiteEditor = () => {
  const { data: sections, isLoading: sectionsLoading } = useSiteSections();
  const { data: allContent, isLoading: contentLoading } = useSiteContent();
  const invalidate = useInvalidateSiteContent();
  const { toast } = useToast();
  const [activeGroup, setActiveGroup] = useState("all");
  const [editedContent, setEditedContent] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const filteredSections = sections?.filter((s) => {
    if (activeGroup === "all") return true;
    if (activeGroup === "landing") return LANDING_SECTIONS.includes(s.section_key);
    if (activeGroup === "pricing") return s.section_key === "pricing" || s.section_key === "stats";
    if (activeGroup === "shop") return s.section_key === "guides" || s.section_key === "merch";
    return !LANDING_SECTIONS.includes(s.section_key);
  });

  const contentBySection = (sectionKey: string) =>
    allContent?.filter((c) => c.section === sectionKey) || [];

  const handleToggleVisibility = async (section: SiteSection) => {
    const { error } = await supabase
      .from("site_sections")
      .update({ is_visible: !section.is_visible, updated_at: new Date().toISOString() })
      .eq("id", section.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      invalidate();
      toast({ title: section.is_visible ? "Section hidden" : "Section visible" });
    }
  };

  const handleContentChange = (id: string, value: string) => {
    setEditedContent((prev) => ({ ...prev, [id]: value }));
  };

  const handleSaveAll = async () => {
    const entries = Object.entries(editedContent);
    if (entries.length === 0) {
      toast({ title: "No changes to save" });
      return;
    }
    setSaving(true);
    try {
      for (const [id, value] of entries) {
        const { error } = await supabase
          .from("site_content")
          .update({ content_value: value, updated_at: new Date().toISOString() })
          .eq("id", id);
        if (error) throw error;
      }
      setEditedContent({});
      invalidate();
      toast({ title: `Saved ${entries.length} change${entries.length > 1 ? "s" : ""}` });
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (sectionsLoading || contentLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  const hasChanges = Object.keys(editedContent).length > 0;

  return (
    <div className="space-y-4">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 flex-wrap">
          {SECTION_GROUPS.map((g) => (
            <button
              key={g.key}
              onClick={() => setActiveGroup(g.key)}
              className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                activeGroup === g.key
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => invalidate()}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-muted text-muted-foreground hover:text-foreground transition-m2 flex items-center gap-1"
          >
            <RefreshCw size={10} /> Refresh
          </button>
          {hasChanges && (
            <button
              onClick={handleSaveAll}
              disabled={saving}
              className="px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest bg-primary text-primary-foreground hover:opacity-90 transition-m2 flex items-center gap-1"
            >
              {saving ? <Loader2 size={10} className="animate-spin" /> : <Save size={10} />}
              Save {Object.keys(editedContent).length} Change{Object.keys(editedContent).length > 1 ? "s" : ""}
            </button>
          )}
        </div>
      </div>

      {/* Section cards */}
      {filteredSections?.map((section) => {
        const items = contentBySection(section.section_key);
        return (
          <div key={section.id} className="bg-card shadow-m2 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-foreground">{section.label}</h3>
              <button
                onClick={() => handleToggleVisibility(section)}
                className={`flex items-center gap-1.5 px-3 py-1 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
                  section.is_visible
                    ? "bg-primary/10 text-primary"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {section.is_visible ? <Eye size={12} /> : <EyeOff size={12} />}
                {section.is_visible ? "Visible" : "Hidden"}
              </button>
            </div>

            {items.length > 0 ? (
              <div className="space-y-3">
                {items.map((item) => {
                  const currentValue = editedContent[item.id] ?? item.content_value;
                  const isEdited = editedContent[item.id] !== undefined;
                  return (
                    <div key={item.id}>
                      <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
                        {item.label || item.content_key}
                        {isEdited && <span className="text-primary ml-1">· edited</span>}
                      </label>
                      {item.content_type === "textarea" ? (
                        <textarea
                          value={currentValue}
                          onChange={(e) => handleContentChange(item.id, e.target.value)}
                          className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none h-20 resize-y"
                        />
                      ) : (
                        <input
                          type="text"
                          value={currentValue}
                          onChange={(e) => handleContentChange(item.id, e.target.value)}
                          className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">
                No editable content fields yet. Toggle visibility above.
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default AdminSiteEditor;

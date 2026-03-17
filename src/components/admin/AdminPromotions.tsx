import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Trash2, Gift, Tag, Loader2, X, Search, Copy } from "lucide-react";
import { toast } from "sonner";

const AdminPromotions = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Promo form state
  const [promoForm, setPromoForm] = useState({
    code: "",
    description: "",
    discount_type: "percent" as "percent" | "fixed" | "free",
    discount_value: 0,
    applies_to: "all" as "all" | "programs" | "subscriptions",
    max_uses: "",
    expires_at: "",
  });

  // Gift form state
  const [giftForm, setGiftForm] = useState({
    user_email: "",
    gift_type: "program" as "program" | "subscription" | "promotion",
    product_id: "",
    notes: "",
  });

  // Fetch promotions
  const { data: promotions = [], isLoading: loadingPromos } = useQuery({
    queryKey: ["admin-promotions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch gifted products
  const { data: gifts = [], isLoading: loadingGifts } = useQuery({
    queryKey: ["admin-gifts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("gifted_products")
        .select("*")
        .order("gifted_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch profiles for gift recipient lookup
  const { data: profiles = [] } = useQuery({
    queryKey: ["admin-profiles-for-gifts"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, email, full_name");
      return data || [];
    },
  });

  // Fetch programs for gift dropdown
  const { data: programs = [] } = useQuery({
    queryKey: ["admin-programs-for-gifts"],
    queryFn: async () => {
      const { data } = await supabase.from("training_programs").select("id, title, price").order("title");
      return data || [];
    },
  });

  const createPromotion = async () => {
    if (!promoForm.code.trim()) { toast.error("Promo code required"); return; }
    setSaving(true);
    const { error } = await supabase.from("promotions").insert({
      code: promoForm.code.trim().toUpperCase(),
      description: promoForm.description,
      discount_type: promoForm.discount_type,
      discount_value: promoForm.discount_value,
      applies_to: promoForm.applies_to,
      max_uses: promoForm.max_uses ? parseInt(promoForm.max_uses) : null,
      expires_at: promoForm.expires_at || null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Promotion created");
    setShowPromoModal(false);
    setPromoForm({ code: "", description: "", discount_type: "percent", discount_value: 0, applies_to: "all", max_uses: "", expires_at: "" });
    qc.invalidateQueries({ queryKey: ["admin-promotions"] });
  };

  const deletePromotion = async (id: string) => {
    if (!confirm("Delete this promotion?")) return;
    await supabase.from("promotions").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-promotions"] });
    toast.success("Deleted");
  };

  const togglePromoActive = async (id: string, currentActive: boolean) => {
    await supabase.from("promotions").update({ is_active: !currentActive }).eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-promotions"] });
  };

  const giftProduct = async () => {
    if (!giftForm.user_email) { toast.error("Select a user"); return; }
    const profile = profiles.find((p) => p.email === giftForm.user_email);
    if (!profile) { toast.error("User not found"); return; }
    setSaving(true);

    // If gifting a program, also activate it
    if (giftForm.gift_type === "program" && giftForm.product_id) {
      // Check if already active
      const { data: existing } = await supabase
        .from("user_active_programs")
        .select("id")
        .eq("user_id", profile.user_id)
        .eq("program_id", giftForm.product_id)
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from("user_active_programs").insert({
          user_id: profile.user_id,
          program_id: giftForm.product_id,
          status: "active",
        });
      }
    }

    const { error } = await supabase.from("gifted_products").insert({
      user_id: profile.user_id,
      gift_type: giftForm.gift_type,
      product_id: giftForm.product_id || null,
      notes: giftForm.notes,
      gifted_by: user!.id,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }

    // Send notification
    await supabase.from("notifications").insert({
      user_id: profile.user_id,
      type: "gift",
      title: "You received a gift from Coach Matt!",
      body: giftForm.notes || "Check your portal for the new addition.",
      link: "/dashboard",
    });

    toast.success(`Gift sent to ${giftForm.user_email}`);
    setShowGiftModal(false);
    setGiftForm({ user_email: "", gift_type: "program", product_id: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["admin-gifts"] });
  };

  const getProfileEmail = (userId: string) => profiles.find((p) => p.user_id === userId)?.email || userId;
  const getProgramTitle = (id: string) => programs.find((p) => p.id === id)?.title || id;

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setShowPromoModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-m2">
          <Tag size={12} /> New Promotion
        </button>
        <button onClick={() => setShowGiftModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-foreground text-background text-[10px] font-bold uppercase tracking-widest hover:bg-foreground/90 transition-m2">
          <Gift size={12} /> Gift a Product
        </button>
      </div>

      {/* Active Promotions */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3">Active Promotions</h3>
        {loadingPromos ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
        ) : promotions.length === 0 ? (
          <div className="bg-card shadow-m2 p-6 text-center text-xs text-muted-foreground">No promotions yet. Create one to offer discounts.</div>
        ) : (
          <div className="space-y-2">
            {promotions.map((p) => (
              <div key={p.id} className={`bg-card shadow-m2 p-4 flex items-start justify-between gap-3 ${!p.is_active ? "opacity-50" : ""}`}>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-bold font-mono text-primary">{p.code}</span>
                    <button onClick={() => { navigator.clipboard.writeText(p.code); toast.success("Copied!"); }} className="text-muted-foreground hover:text-foreground"><Copy size={12} /></button>
                    <span className={`text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5 ${p.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {p.is_active ? "Active" : "Disabled"}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">{p.description}</p>
                  <div className="flex gap-3 mt-1.5 text-[10px] text-muted-foreground">
                    <span>{p.discount_type === "free" ? "FREE" : p.discount_type === "percent" ? `${p.discount_value}% off` : `$${p.discount_value} off`}</span>
                    <span>Applies to: {p.applies_to}</span>
                    <span>Uses: {p.current_uses}{p.max_uses ? `/${p.max_uses}` : ""}</span>
                    {p.expires_at && <span>Expires: {new Date(p.expires_at).toLocaleDateString()}</span>}
                  </div>
                </div>
                <div className="flex gap-1">
                  <button onClick={() => togglePromoActive(p.id, p.is_active)} className="px-2 py-1 text-[9px] font-bold uppercase bg-muted text-muted-foreground hover:text-foreground transition-m2">
                    {p.is_active ? "Disable" : "Enable"}
                  </button>
                  <button onClick={() => deletePromotion(p.id)} className="p-1.5 hover:bg-destructive/10 transition-m2"><Trash2 size={13} className="text-destructive" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Gift History */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3">Gift History</h3>
        {loadingGifts ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
        ) : gifts.length === 0 ? (
          <div className="bg-card shadow-m2 p-6 text-center text-xs text-muted-foreground">No gifts sent yet.</div>
        ) : (
          <div className="space-y-2">
            {gifts.map((g) => (
              <div key={g.id} className="bg-card shadow-m2 p-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-foreground">{getProfileEmail(g.user_id)}</span>
                  <div className="flex gap-2 mt-0.5 text-[10px] text-muted-foreground">
                    <span className="uppercase font-bold">{g.gift_type}</span>
                    {g.product_id && <span>· {getProgramTitle(g.product_id)}</span>}
                    {g.notes && <span>· {g.notes}</span>}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground">{new Date(g.gifted_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create Promotion Modal */}
      {showPromoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowPromoModal(false)}>
          <div className="bg-card border border-border shadow-m2 w-full max-w-md max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">New Promotion</h3>
              <button onClick={() => setShowPromoModal(false)}><X size={16} className="text-muted-foreground" /></button>
            </div>

            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Promo Code *</label>
            <input type="text" value={promoForm.code} onChange={(e) => setPromoForm({ ...promoForm, code: e.target.value })} placeholder="e.g. SUMMER25" className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground mb-3 outline-none focus:ring-1 focus:ring-primary uppercase font-mono" />

            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Description</label>
            <input type="text" value={promoForm.description} onChange={(e) => setPromoForm({ ...promoForm, description: e.target.value })} placeholder="Summer sale — 25% off all programs" className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground mb-3 outline-none focus:ring-1 focus:ring-primary" />

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Discount Type</label>
                <select value={promoForm.discount_type} onChange={(e) => setPromoForm({ ...promoForm, discount_type: e.target.value as any })} className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary">
                  <option value="percent">Percentage</option>
                  <option value="fixed">Fixed Amount</option>
                  <option value="free">Free</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{promoForm.discount_type === "percent" ? "% Off" : "$ Off"}</label>
                <input type="number" value={promoForm.discount_value} onChange={(e) => setPromoForm({ ...promoForm, discount_value: parseFloat(e.target.value) || 0 })} disabled={promoForm.discount_type === "free"} className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary disabled:opacity-50" />
              </div>
            </div>

            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Applies To</label>
            <select value={promoForm.applies_to} onChange={(e) => setPromoForm({ ...promoForm, applies_to: e.target.value as any })} className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground mb-3 outline-none focus:ring-1 focus:ring-primary">
              <option value="all">All Products</option>
              <option value="programs">Programs Only</option>
              <option value="subscriptions">Subscriptions Only</option>
            </select>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Max Uses (blank = unlimited)</label>
                <input type="number" value={promoForm.max_uses} onChange={(e) => setPromoForm({ ...promoForm, max_uses: e.target.value })} className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Expires (optional)</label>
                <input type="date" value={promoForm.expires_at} onChange={(e) => setPromoForm({ ...promoForm, expires_at: e.target.value })} className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>

            <button onClick={createPromotion} disabled={saving} className="w-full py-2.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50 transition-m2">
              {saving ? "Creating..." : "Create Promotion"}
            </button>
          </div>
        </div>
      )}

      {/* Gift Modal */}
      {showGiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowGiftModal(false)}>
          <div className="bg-card border border-border shadow-m2 w-full max-w-md max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Gift a Product</h3>
              <button onClick={() => setShowGiftModal(false)}><X size={16} className="text-muted-foreground" /></button>
            </div>

            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Recipient *</label>
            <select value={giftForm.user_email} onChange={(e) => setGiftForm({ ...giftForm, user_email: e.target.value })} className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground mb-3 outline-none focus:ring-1 focus:ring-primary">
              <option value="">Select user...</option>
              {profiles.map((p) => (
                <option key={p.user_id} value={p.email || ""}>{p.full_name || p.email} ({p.email})</option>
              ))}
            </select>

            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Gift Type</label>
            <select value={giftForm.gift_type} onChange={(e) => setGiftForm({ ...giftForm, gift_type: e.target.value as any })} className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground mb-3 outline-none focus:ring-1 focus:ring-primary">
              <option value="program">Interactive Program</option>
              <option value="promotion">Promo Code</option>
            </select>

            {giftForm.gift_type === "program" && (
              <>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Program</label>
                <select value={giftForm.product_id} onChange={(e) => setGiftForm({ ...giftForm, product_id: e.target.value })} className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground mb-3 outline-none focus:ring-1 focus:ring-primary">
                  <option value="">Select program...</option>
                  {programs.map((p) => (
                    <option key={p.id} value={p.id}>{p.title} (${p.price})</option>
                  ))}
                </select>
              </>
            )}

            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Personal Note (optional)</label>
            <textarea value={giftForm.notes} onChange={(e) => setGiftForm({ ...giftForm, notes: e.target.value })} placeholder="Hey! Enjoy this on me..." className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground mb-4 outline-none focus:ring-1 focus:ring-primary h-16 resize-none" />

            <button onClick={giftProduct} disabled={saving} className="w-full py-2.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50 transition-m2">
              {saving ? "Sending..." : "Send Gift"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPromotions;

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Plus, Trash2, Gift, Tag, Loader2, X, Search, Copy, Sparkles, CreditCard, UserPlus } from "lucide-react";
import { toast } from "sonner";
import AiAssistButton from "./AiAssistButton";

const AdminPromotions = () => {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [showPromoModal, setShowPromoModal] = useState(false);
  const [showStripePromoModal, setShowStripePromoModal] = useState(false);
  const [showGiftModal, setShowGiftModal] = useState(false);
  const [showDirectGiftModal, setShowDirectGiftModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Promo form state (internal DB promos)
  const [promoForm, setPromoForm] = useState({
    code: "",
    description: "",
    discount_type: "percent" as "percent" | "fixed" | "free",
    discount_value: 0,
    applies_to: "all" as "all" | "programs" | "subscriptions",
    max_uses: "",
    expires_at: "",
  });

  // Stripe promo form state
  const [stripeForm, setStripeForm] = useState({
    code: "",
    discount_type: "percent" as "percent" | "fixed",
    discount_value: 0,
    duration: "once" as "once" | "repeating" | "forever",
    duration_in_months: 3,
    max_redemptions: "",
    expires_at: "",
  });

  // Gift form state (legacy)
  const [giftForm, setGiftForm] = useState({
    user_email: "",
    gift_type: "program" as "program" | "subscription" | "promotion",
    product_id: "",
    notes: "",
  });

  // Direct gift form state (new user_content_access)
  const [directGiftForm, setDirectGiftForm] = useState({
    email_search: "",
    selected_user_id: "",
    selected_email: "",
    content_type: "program" as "program" | "workout",
    content_id: "",
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

  // Fetch gifted products (legacy)
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

  // Fetch direct gifts (new user_content_access)
  const { data: directGifts = [] } = useQuery({
    queryKey: ["admin-direct-gifts"],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_content_access")
        .select("*")
        .order("granted_at", { ascending: false });
      return data || [];
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

  // Fetch workouts for gift dropdown
  const { data: workouts = [] } = useQuery({
    queryKey: ["admin-workouts-for-gifts"],
    queryFn: async () => {
      const { data } = await supabase.from("daily_workouts").select("id, title").eq("is_active", true).order("title");
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

  const createStripePromo = async () => {
    if (!stripeForm.code.trim()) { toast.error("Code required"); return; }
    if (stripeForm.discount_value <= 0) { toast.error("Discount value required"); return; }
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-stripe-promo", {
        body: {
          code: stripeForm.code,
          discount_type: stripeForm.discount_type,
          discount_value: stripeForm.discount_value,
          duration: stripeForm.duration,
          duration_in_months: stripeForm.duration === "repeating" ? stripeForm.duration_in_months : undefined,
          max_redemptions: stripeForm.max_redemptions ? parseInt(stripeForm.max_redemptions) : undefined,
          expires_at: stripeForm.expires_at || undefined,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Stripe promo code "${data.code}" created successfully`);
      setShowStripePromoModal(false);
      setStripeForm({ code: "", discount_type: "percent", discount_value: 0, duration: "once", duration_in_months: 3, max_redemptions: "", expires_at: "" });
    } catch (err: any) {
      toast.error(err.message || "Failed to create Stripe promo");
    }
    setSaving(false);
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

    if (giftForm.gift_type === "program" && giftForm.product_id) {
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

  const grantDirectAccess = async () => {
    if (!directGiftForm.selected_user_id) { toast.error("Select a user"); return; }
    if (!directGiftForm.content_id) { toast.error("Select content"); return; }
    setSaving(true);

    const insertRow: any = {
      user_id: directGiftForm.selected_user_id,
      access_type: "gifted",
      granted_by: user!.id,
      notes: directGiftForm.notes || null,
    };

    if (directGiftForm.content_type === "program") {
      insertRow.program_id = directGiftForm.content_id;
      // Also activate in user_active_programs
      const { data: existing } = await supabase
        .from("user_active_programs")
        .select("id")
        .eq("user_id", directGiftForm.selected_user_id)
        .eq("program_id", directGiftForm.content_id)
        .limit(1);

      if (!existing || existing.length === 0) {
        await supabase.from("user_active_programs").insert({
          user_id: directGiftForm.selected_user_id,
          program_id: directGiftForm.content_id,
          status: "active",
        });
      }
    } else {
      insertRow.workout_id = directGiftForm.content_id;
    }

    const { error } = await supabase.from("user_content_access").insert(insertRow);
    setSaving(false);
    if (error) {
      if (error.message.includes("duplicate")) {
        toast.error("User already has access to this content");
      } else {
        toast.error(error.message);
      }
      return;
    }

    await supabase.from("notifications").insert({
      user_id: directGiftForm.selected_user_id,
      type: "gift",
      title: "You've been granted free access!",
      body: directGiftForm.notes || "Coach Matt unlocked new content for you.",
      link: directGiftForm.content_type === "program" ? "/dashboard" : "/dashboard",
    });

    toast.success(`Access granted to ${directGiftForm.selected_email}`);
    setShowDirectGiftModal(false);
    setDirectGiftForm({ email_search: "", selected_user_id: "", selected_email: "", content_type: "program", content_id: "", notes: "" });
    qc.invalidateQueries({ queryKey: ["admin-direct-gifts"] });
  };

  const revokeDirectAccess = async (id: string) => {
    if (!confirm("Revoke this access?")) return;
    await supabase.from("user_content_access").delete().eq("id", id);
    qc.invalidateQueries({ queryKey: ["admin-direct-gifts"] });
    toast.success("Access revoked");
  };

  const filteredProfiles = profiles.filter(
    (p) => directGiftForm.email_search && (
      (p.email || "").toLowerCase().includes(directGiftForm.email_search.toLowerCase()) ||
      (p.full_name || "").toLowerCase().includes(directGiftForm.email_search.toLowerCase())
    )
  );

  const getProfileEmail = (userId: string) => profiles.find((p) => p.user_id === userId)?.email || userId;
  const getProgramTitle = (id: string) => programs.find((p) => p.id === id)?.title || id;
  const getWorkoutTitle = (id: string) => workouts.find((w) => w.id === id)?.title || id;

  return (
    <div className="space-y-6">
      {/* Action buttons */}
      <div className="flex gap-2 flex-wrap">
        <button onClick={() => setShowStripePromoModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 transition-m2">
          <CreditCard size={12} /> Stripe Promo Code
        </button>
        <button onClick={() => setShowPromoModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-muted text-foreground text-[10px] font-bold uppercase tracking-widest hover:bg-muted/80 transition-m2">
          <Tag size={12} /> Internal Promo
        </button>
        <button onClick={() => setShowDirectGiftModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-foreground text-background text-[10px] font-bold uppercase tracking-widest hover:bg-foreground/90 transition-m2">
          <UserPlus size={12} /> Direct Gift
        </button>
        <button onClick={() => setShowGiftModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-muted text-foreground text-[10px] font-bold uppercase tracking-widest hover:bg-muted/80 transition-m2">
          <Gift size={12} /> Legacy Gift
        </button>
        <AiAssistButton
          type="promo_suggest"
          context={{
            month: new Date().toLocaleString("default", { month: "long", year: "numeric" }),
            existingCodes: promotions.map((p: any) => p.code).join(", "),
          }}
          onResult={(text) => {
            try {
              const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
              const ideas = JSON.parse(cleaned);
              if (Array.isArray(ideas) && ideas.length > 0) {
                const first = ideas[0];
                setPromoForm({
                  code: first.code || "",
                  description: first.description || "",
                  discount_type: first.discount_type || "percent",
                  discount_value: first.discount_value || 0,
                  applies_to: first.applies_to || "all",
                  max_uses: "",
                  expires_at: "",
                });
                setShowPromoModal(true);
                toast.success(`${ideas.length} ideas generated — first one loaded.`);
              }
            } catch {
              toast.error("Couldn't parse AI suggestions");
            }
          }}
          label="AI Suggest"
        />
      </div>

      {/* Direct Gift Access History */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3">Direct Content Access</h3>
        {directGifts.length === 0 ? (
          <div className="bg-card shadow-m2 p-6 text-center text-xs text-muted-foreground">No direct gifts yet. Use "Direct Gift" to grant free access to programs or workouts.</div>
        ) : (
          <div className="space-y-2">
            {directGifts.map((g: any) => (
              <div key={g.id} className="bg-card shadow-m2 p-3 flex items-center justify-between">
                <div>
                  <span className="text-xs font-bold text-foreground">{getProfileEmail(g.user_id)}</span>
                  <div className="flex gap-2 mt-0.5 text-[10px] text-muted-foreground">
                    {g.program_id && <span>Program: {getProgramTitle(g.program_id)}</span>}
                    {g.workout_id && <span>Workout: {getWorkoutTitle(g.workout_id)}</span>}
                    {g.notes && <span>· {g.notes}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground">{new Date(g.granted_at).toLocaleDateString()}</span>
                  <button onClick={() => revokeDirectAccess(g.id)} className="p-1 hover:bg-destructive/10 transition-m2"><Trash2 size={13} className="text-destructive" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Active Promotions */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3">Internal Promotions</h3>
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

      {/* Legacy Gift History */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3">Legacy Gift History</h3>
        {loadingGifts ? (
          <div className="flex justify-center py-8"><Loader2 size={20} className="animate-spin text-primary" /></div>
        ) : gifts.length === 0 ? (
          <div className="bg-card shadow-m2 p-6 text-center text-xs text-muted-foreground">No legacy gifts sent yet.</div>
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

      {/* Stripe Promo Code Modal */}
      {showStripePromoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowStripePromoModal(false)}>
          <div className="bg-card border border-border shadow-m2 w-full max-w-md max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">New Stripe Promo Code</h3>
              <button onClick={() => setShowStripePromoModal(false)}><X size={16} className="text-muted-foreground" /></button>
            </div>
            <p className="text-[10px] text-muted-foreground mb-4">Creates a native Stripe promotion code. Customers can enter this on the Stripe checkout page for memberships.</p>

            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Code Name *</label>
            <input type="text" value={stripeForm.code} onChange={(e) => setStripeForm({ ...stripeForm, code: e.target.value })} placeholder="e.g. LAUNCH50" className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground mb-3 outline-none focus:ring-1 focus:ring-primary uppercase font-mono" />

            <div className="grid grid-cols-2 gap-3 mb-3">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Discount Type</label>
                <select value={stripeForm.discount_type} onChange={(e) => setStripeForm({ ...stripeForm, discount_type: e.target.value as any })} className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary">
                  <option value="percent">Percentage</option>
                  <option value="fixed">Flat Amount ($)</option>
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">{stripeForm.discount_type === "percent" ? "% Off" : "$ Off"}</label>
                <input type="number" value={stripeForm.discount_value} onChange={(e) => setStripeForm({ ...stripeForm, discount_value: parseFloat(e.target.value) || 0 })} className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>

            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Duration</label>
            <select value={stripeForm.duration} onChange={(e) => setStripeForm({ ...stripeForm, duration: e.target.value as any })} className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground mb-3 outline-none focus:ring-1 focus:ring-primary">
              <option value="once">Once (first payment only)</option>
              <option value="repeating">Repeating (X months)</option>
              <option value="forever">Forever (all payments)</option>
            </select>

            {stripeForm.duration === "repeating" && (
              <div className="mb-3">
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Number of Months</label>
                <input type="number" min={1} max={36} value={stripeForm.duration_in_months} onChange={(e) => setStripeForm({ ...stripeForm, duration_in_months: parseInt(e.target.value) || 3 })} className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Max Redemptions</label>
                <input type="number" value={stripeForm.max_redemptions} onChange={(e) => setStripeForm({ ...stripeForm, max_redemptions: e.target.value })} placeholder="Unlimited" className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Expiration Date</label>
                <input type="date" value={stripeForm.expires_at} onChange={(e) => setStripeForm({ ...stripeForm, expires_at: e.target.value })} className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>

            <button onClick={createStripePromo} disabled={saving} className="w-full py-2.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50 transition-m2">
              {saving ? "Creating in Stripe..." : "Create Stripe Promo"}
            </button>
          </div>
        </div>
      )}

      {/* Create Internal Promotion Modal */}
      {showPromoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowPromoModal(false)}>
          <div className="bg-card border border-border shadow-m2 w-full max-w-md max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">New Internal Promotion</h3>
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

      {/* Direct Gift Modal */}
      {showDirectGiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowDirectGiftModal(false)}>
          <div className="bg-card border border-border shadow-m2 w-full max-w-md max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Direct Gift — Grant Access</h3>
              <button onClick={() => setShowDirectGiftModal(false)}><X size={16} className="text-muted-foreground" /></button>
            </div>
            <p className="text-[10px] text-muted-foreground mb-4">Permanently unlock a program or workout for a user — no Stripe required.</p>

            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Search User by Email *</label>
            <div className="relative mb-3">
              <input
                type="text"
                value={directGiftForm.selected_email || directGiftForm.email_search}
                onChange={(e) => setDirectGiftForm({ ...directGiftForm, email_search: e.target.value, selected_user_id: "", selected_email: "" })}
                placeholder="Start typing email..."
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground outline-none focus:ring-1 focus:ring-primary"
              />
              {filteredProfiles.length > 0 && !directGiftForm.selected_user_id && (
                <div className="absolute z-10 top-full left-0 right-0 bg-card border border-border shadow-m2 max-h-40 overflow-y-auto">
                  {filteredProfiles.slice(0, 8).map((p) => (
                    <button
                      key={p.user_id}
                      onClick={() => setDirectGiftForm({ ...directGiftForm, selected_user_id: p.user_id, selected_email: p.email || "", email_search: "" })}
                      className="w-full text-left px-3 py-2 text-xs hover:bg-muted transition-m2"
                    >
                      {p.full_name && <span className="font-bold">{p.full_name} — </span>}
                      <span className="text-muted-foreground">{p.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Content Type</label>
            <select value={directGiftForm.content_type} onChange={(e) => setDirectGiftForm({ ...directGiftForm, content_type: e.target.value as any, content_id: "" })} className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground mb-3 outline-none focus:ring-1 focus:ring-primary">
              <option value="program">Program</option>
              <option value="workout">Workout</option>
            </select>

            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">
              {directGiftForm.content_type === "program" ? "Select Program" : "Select Workout"}
            </label>
            <select value={directGiftForm.content_id} onChange={(e) => setDirectGiftForm({ ...directGiftForm, content_id: e.target.value })} className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground mb-3 outline-none focus:ring-1 focus:ring-primary">
              <option value="">Choose...</option>
              {directGiftForm.content_type === "program"
                ? programs.map((p) => <option key={p.id} value={p.id}>{p.title} (${p.price})</option>)
                : workouts.map((w) => <option key={w.id} value={w.id}>{w.title}</option>)
              }
            </select>

            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Note (optional)</label>
            <textarea value={directGiftForm.notes} onChange={(e) => setDirectGiftForm({ ...directGiftForm, notes: e.target.value })} placeholder="e.g. Comp'd for beta testing" className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground mb-4 outline-none focus:ring-1 focus:ring-primary h-16 resize-none" />

            <button onClick={grantDirectAccess} disabled={saving} className="w-full py-2.5 bg-primary text-primary-foreground text-[10px] font-bold uppercase tracking-widest hover:bg-primary/90 disabled:opacity-50 transition-m2">
              {saving ? "Granting..." : "Grant Access"}
            </button>
          </div>
        </div>
      )}

      {/* Legacy Gift Modal */}
      {showGiftModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setShowGiftModal(false)}>
          <div className="bg-card border border-border shadow-m2 w-full max-w-md max-h-[85vh] overflow-y-auto p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-bold text-foreground">Gift a Product (Legacy)</h3>
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

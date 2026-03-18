import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Settings, Quote, Users, Loader2, Save, Check } from "lucide-react";
import { toast } from "sonner";

const AdminSystemSettings = () => {
  const queryClient = useQueryClient();

  // ─── Testimonial CMS ───
  const { data: testimonialQuote } = useQuery({
    queryKey: ["site-content", "testimonial_quote"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_content")
        .select("content_value")
        .eq("section", "welcome_page")
        .eq("content_key", "testimonial_quote")
        .single();
      return data?.content_value || "";
    },
  });

  const { data: testimonialAuthor } = useQuery({
    queryKey: ["site-content", "testimonial_author"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_content")
        .select("content_value")
        .eq("section", "welcome_page")
        .eq("content_key", "testimonial_author")
        .single();
      return data?.content_value || "";
    },
  });

  const [quote, setQuote] = useState("");
  const [author, setAuthor] = useState("");

  useEffect(() => { if (testimonialQuote !== undefined) setQuote(testimonialQuote); }, [testimonialQuote]);
  useEffect(() => { if (testimonialAuthor !== undefined) setAuthor(testimonialAuthor); }, [testimonialAuthor]);

  const saveTestimonial = useMutation({
    mutationFn: async () => {
      // Upsert quote
      const { error: e1 } = await supabase.from("site_content").upsert({
        section: "welcome_page",
        content_key: "testimonial_quote",
        content_value: quote,
        label: "Front Page Testimonial Quote",
        content_type: "text",
      }, { onConflict: "section,content_key" });
      if (e1) throw e1;

      const { error: e2 } = await supabase.from("site_content").upsert({
        section: "welcome_page",
        content_key: "testimonial_author",
        content_value: author,
        label: "Testimonial Author",
        content_type: "text",
      }, { onConflict: "section,content_key" });
      if (e2) throw e2;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-content"] });
      toast.success("Testimonial updated");
    },
    onError: (e: any) => toast.error(e.message || "Failed to save"),
  });

  // ─── Parent Email Toggle ───
  const { data: parentEmailSetting } = useQuery({
    queryKey: ["site-content", "parent_emails_enabled"],
    queryFn: async () => {
      const { data } = await supabase
        .from("site_content")
        .select("content_value")
        .eq("section", "system_settings")
        .eq("content_key", "parent_emails_enabled")
        .single();
      return data?.content_value === "true";
    },
  });

  const [parentEmails, setParentEmails] = useState(false);
  useEffect(() => { if (parentEmailSetting !== undefined) setParentEmails(parentEmailSetting); }, [parentEmailSetting]);

  const toggleParentEmails = useMutation({
    mutationFn: async (enabled: boolean) => {
      const { error } = await supabase.from("site_content").upsert({
        section: "system_settings",
        content_key: "parent_emails_enabled",
        content_value: String(enabled),
        label: "Sunday Parent Emails",
        content_type: "boolean",
      }, { onConflict: "section,content_key" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["site-content", "parent_emails_enabled"] });
      toast.success("Parent email setting updated");
    },
    onError: () => toast.error("Failed to update"),
  });

  // ─── Referral Tracking ───
  const { data: recentReferrals = [], isLoading: referralsLoading } = useQuery({
    queryKey: ["admin-recent-referrals"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_conversions")
        .select("*, referral_code, created_at, subscription_tier")
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;

      // Get referrer profiles
      const referrerIds = [...new Set((data || []).map((r: any) => r.referrer_user_id))];
      const referredIds = [...new Set((data || []).map((r: any) => r.referred_user_id))];
      const allIds = [...new Set([...referrerIds, ...referredIds])];

      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email, athlete_name")
        .in("user_id", allIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));

      return (data || []).map((r: any) => ({
        ...r,
        referrer: profileMap.get(r.referrer_user_id),
        referred: profileMap.get(r.referred_user_id),
      }));
    },
  });

  // ─── Referral leaderboard ───
  const { data: referralCodes = [] } = useQuery({
    queryKey: ["admin-referral-codes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("referral_codes")
        .select("*")
        .gt("total_referrals", 0)
        .order("total_referrals", { ascending: false })
        .limit(10);
      if (error) throw error;

      const userIds = (data || []).map((r: any) => r.user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, full_name, email")
        .in("user_id", userIds);

      const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
      return (data || []).map((r: any) => ({ ...r, profile: profileMap.get(r.user_id) }));
    },
  });

  return (
    <div className="space-y-6">
      {/* Parent Email Toggle */}
      <div className="bg-card shadow-m2 p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Settings size={16} className="text-primary" />
            <h3 className="text-sm font-bold text-foreground">Automated Sunday Parent Emails</h3>
          </div>
          <button
            onClick={() => {
              const newVal = !parentEmails;
              setParentEmails(newVal);
              toggleParentEmails.mutate(newVal);
            }}
            className={`relative w-12 h-6 rounded-full transition-colors ${
              parentEmails ? "bg-primary" : "bg-muted"
            }`}
          >
            <div className={`absolute top-0.5 w-5 h-5 bg-primary-foreground rounded-full transition-transform ${
              parentEmails ? "left-[26px]" : "left-0.5"
            }`} />
          </button>
        </div>
        <p className="text-[11px] text-muted-foreground">
          When ON, parents receive a weekly progress email every Sunday with their child's workout summary.
          Currently: <span className={`font-bold ${parentEmails ? "text-green-400" : "text-muted-foreground"}`}>{parentEmails ? "ON" : "OFF"}</span>
        </p>
      </div>

      {/* Testimonial CMS */}
      <div className="bg-card shadow-m2 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Quote size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">Front Page Testimonial</h3>
        </div>
        <p className="text-[11px] text-muted-foreground mb-4">
          Update the parent testimonial displayed on the Welcome and Landing pages.
        </p>
        <div className="space-y-3">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Quote</label>
            <textarea
              value={quote}
              onChange={(e) => setQuote(e.target.value)}
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none h-24"
              placeholder="Enter the testimonial quote..."
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Author (e.g. "Sarah M., Grosse Pointe Parent")</label>
            <input
              value={author}
              onChange={(e) => setAuthor(e.target.value)}
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
              placeholder="Author name and location"
            />
          </div>
          <button
            onClick={() => saveTestimonial.mutate()}
            disabled={saveTestimonial.isPending}
            className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-1.5 disabled:opacity-50"
          >
            {saveTestimonial.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            Save Testimonial
          </button>
        </div>
      </div>

      {/* Referral Advocates */}
      <div className="bg-card shadow-m2 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Users size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">Top Referral Advocates</h3>
        </div>
        {referralCodes.length === 0 ? (
          <p className="text-xs text-muted-foreground">No referrals yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {referralCodes.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-bold text-foreground">{r.profile?.full_name || r.profile?.email || "Unknown"}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{r.code}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-mono font-bold text-primary">{r.total_referrals}</p>
                  <p className="text-[9px] text-muted-foreground">referrals</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Referral Conversions */}
      <div className="bg-card shadow-m2 p-5">
        <div className="flex items-center gap-2 mb-3">
          <Check size={16} className="text-primary" />
          <h3 className="text-sm font-bold text-foreground">Recent Referral Conversions</h3>
        </div>
        {referralsLoading ? (
          <Loader2 className="animate-spin text-primary" size={16} />
        ) : recentReferrals.length === 0 ? (
          <p className="text-xs text-muted-foreground">No conversions yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {recentReferrals.map((r: any) => (
              <div key={r.id} className="py-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-foreground">
                      <span className="font-bold">{r.referrer?.full_name || r.referrer?.email || "Unknown"}</span>
                      {" → "}
                      <span className="text-muted-foreground">{r.referred?.full_name || r.referred?.email || "Unknown"}</span>
                    </p>
                    <p className="text-[9px] text-muted-foreground font-mono">{r.referral_code} · {r.subscription_tier || "free"}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminSystemSettings;

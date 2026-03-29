import { useState, useEffect } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Search, Download, Lock, CheckCircle, Loader2, ArrowRight, Phone } from "lucide-react";

const SAMPLE_DATA = [
  { business_name: "Advanced Dental Group", owner_name: "Dr. Sarah K.", phone: "(313) 5██-████", email: "info@██████.com", city: "Troy", state: "MI", rating: 4.8 },
  { business_name: "Lakeside Family Dentistry", owner_name: "Dr. M. Williams", phone: "(248) 7██-████", email: "dr.w████@gmail.com", city: "Bloomfield Hills", state: "MI", rating: 4.9 },
  { business_name: "Midwest Orthodontics", owner_name: "Dr. Chen", phone: "(734) 4██-████", email: "info@midw████.com", city: "Ann Arbor", state: "MI", rating: 4.7 },
  { business_name: "Great Lakes Dental Care", owner_name: "Dr. P. Johnson", phone: "(616) 3██-████", email: "contac████@gmail.com", city: "Grand Rapids", state: "MI", rating: 4.6 },
  { business_name: "Smile Specialists of Ohio", owner_name: "Dr. Rivera", phone: "(614) 8██-████", email: "smile████@yahoo.com", city: "Columbus", state: "OH", rating: 4.8 },
];

interface B2BContact {
  id: string;
  business_name: string;
  owner_name: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  city: string | null;
  state: string | null;
  rating: number | null;
  review_count: number | null;
}

export default function B2BLeads() {
  const [isSubscriber, setIsSubscriber] = useState(false);
  const [contacts, setContacts] = useState<B2BContact[]>([]);
  const [loading, setLoading] = useState(false);
  const [checkingAccess, setCheckingAccess] = useState(true);
  const [filter, setFilter] = useState({ state: "", city: "", search: "" });
  const [signupForm, setSignupForm] = useState({ email: "", name: "" });
  const [signingUp, setSigningUp] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  const urlParams = new URLSearchParams(window.location.search);
  const successParam = urlParams.get("success");

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    setCheckingAccess(true);
    try {
      // Check if current user's email is a subscriber
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const { data } = await supabase
          .from("b2b_subscribers" as any)
          .select("active")
          .eq("email", user.email)
          .eq("active", true)
          .limit(1);
        if (data && data.length > 0) {
          setIsSubscriber(true);
          fetchContacts();
          return;
        }
      }
      // Also check total count for display
      const { count } = await supabase.from("b2b_contacts" as any).select("id", { count: "exact", head: true }).eq("industry", "dental");
      setTotalCount(count || 0);
    } finally {
      setCheckingAccess(false);
    }
  }

  async function fetchContacts() {
    setLoading(true);
    try {
      let query = (supabase.from("b2b_contacts" as any) as any)
        .select("id, business_name, owner_name, phone, email, website, city, state, rating, review_count")
        .eq("industry", "dental")
        .order("state")
        .order("city")
        .limit(200);

      if (filter.state) query = query.eq("state", filter.state);
      if (filter.city) query = query.ilike("city", `%${filter.city}%`);
      if (filter.search) query = query.ilike("business_name", `%${filter.search}%`);

      const { data, count } = await query;
      setContacts(data || []);
      const { count: total } = await (supabase.from("b2b_contacts" as any) as any).select("id", { count: "exact", head: true }).eq("industry", "dental");
      setTotalCount(total || 0);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isSubscriber) fetchContacts();
  }, [filter]);

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    if (!signupForm.email) { toast.error("Email is required"); return; }
    setSigningUp(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-b2b-checkout", {
        body: { ...signupForm, niche: "dental" },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setSigningUp(false);
    }
  }

  function exportCSV() {
    if (!contacts.length) return;
    const headers = ["Business Name", "Owner", "Phone", "Email", "Website", "City", "State", "Rating"];
    const rows = contacts.map(c => [c.business_name, c.owner_name || "", c.phone || "", c.email || "", c.website || "", c.city || "", c.state || "", c.rating?.toString() || ""]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "m2-dental-leads.csv"; a.click();
  }

  if (checkingAccess) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-primary" />
      </div>
    );
  }

  if (isSubscriber || successParam === "1") {
    return (
      <>
        <SEOHead title="Dental Practice Database — M² B2B Leads" description="Browse and export dental practice contacts across the Midwest." />
        <div className="min-h-screen bg-background text-foreground p-6">
          <div className="max-w-5xl mx-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-xl font-black text-foreground">Dental Practice Database</h1>
                <p className="text-sm text-muted-foreground">{totalCount.toLocaleString()} verified practices across the Midwest · Updated daily</p>
              </div>
              <button onClick={exportCSV} className="bg-primary text-white px-4 py-2 text-[11px] font-bold uppercase tracking-widest flex items-center gap-2 hover:opacity-90 transition-all">
                <Download size={12} /> Export CSV
              </button>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              <input
                value={filter.search} onChange={e => setFilter(f => ({...f, search: e.target.value}))}
                placeholder="Search by name…"
                className="bg-card border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
              />
              <select value={filter.state} onChange={e => setFilter(f => ({...f, state: e.target.value}))}
                className="bg-card border border-border px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none">
                <option value="">All States</option>
                {["MI", "OH", "IN", "IL", "WI", "MN"].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
              <input
                value={filter.city} onChange={e => setFilter(f => ({...f, city: e.target.value}))}
                placeholder="Filter by city…"
                className="bg-card border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
              />
            </div>

            {/* Table */}
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-primary" /></div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      {["Business", "Phone", "Email", "City", "State", "Rating"].map(h => (
                        <th key={h} className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {contacts.map(c => (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-accent/20 transition-all">
                        <td className="py-2 px-3 font-medium text-foreground">{c.business_name}</td>
                        <td className="py-2 px-3 text-muted-foreground">{c.phone || "—"}</td>
                        <td className="py-2 px-3 text-muted-foreground text-[12px]">{c.email || "—"}</td>
                        <td className="py-2 px-3 text-muted-foreground">{c.city || "—"}</td>
                        <td className="py-2 px-3 text-muted-foreground">{c.state || "—"}</td>
                        <td className="py-2 px-3 text-primary font-bold">{c.rating ? `${c.rating}★` : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {contacts.length === 0 && <p className="text-center text-muted-foreground py-8">No results — try adjusting filters</p>}
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // Paywall view
  return (
    <>
      <SEOHead title="Midwest Dental Practice Database — $149/month | M² B2B Leads" description="Every dental office, orthodontic practice, and oral surgery clinic in the Midwest. Updated daily. Browse, filter, and export." />
      <div className="min-h-screen bg-background text-foreground">
        <div className="bg-[#1e293b] text-white px-6 py-14 text-center">
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary mb-3">M² B2B Intelligence</p>
          <h1 className="text-3xl font-black mb-4">Every dental practice<br />in the Midwest.</h1>
          <p className="text-slate-300 max-w-xl mx-auto text-sm leading-relaxed">
            {totalCount > 0 ? `${totalCount.toLocaleString()} verified` : "Thousands of"} dental offices, orthodontic practices, and oral surgery clinics — with name, phone, email, address, and Google rating. Updated daily. Export to CSV anytime.
          </p>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-12">
          {/* Blurred sample table */}
          <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground mb-4">Sample Data (blurred)</h2>
          <div className="border border-border overflow-hidden mb-10 relative">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/50 to-background z-10 flex items-end justify-center pb-8">
              <div className="flex items-center gap-2 bg-card border border-border px-4 py-2.5 shadow-lg">
                <Lock size={14} className="text-primary" />
                <span className="text-sm font-bold text-foreground">Subscribe to unlock full database</span>
              </div>
            </div>
            <table className="w-full text-sm blur-[2px]">
              <thead>
                <tr className="border-b border-border bg-card">
                  {["Business", "Phone", "Email", "City", "State", "Rating"].map(h => (
                    <th key={h} className="text-left py-2 px-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {SAMPLE_DATA.map((c, i) => (
                  <tr key={i} className="border-b border-border/50">
                    <td className="py-2 px-3 font-medium">{c.business_name}</td>
                    <td className="py-2 px-3 text-muted-foreground">{c.phone}</td>
                    <td className="py-2 px-3 text-muted-foreground text-[12px]">{c.email}</td>
                    <td className="py-2 px-3 text-muted-foreground">{c.city}</td>
                    <td className="py-2 px-3 text-muted-foreground">{c.state}</td>
                    <td className="py-2 px-3 text-primary font-bold">{c.rating}★</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* What you get */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
            {[
              "Business name + Google rating",
              "Direct phone number",
              "Email address (when available)",
              "Full address + city/state",
              "Website URL",
              "Filter by state, city, or name",
              "CSV export anytime",
              "Updated daily — always fresh",
            ].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm text-foreground">
                <CheckCircle size={14} className="text-primary flex-shrink-0" /> {f}
              </div>
            ))}
          </div>

          {/* Signup */}
          <div className="bg-card border border-border p-6">
            <div className="flex items-end justify-between mb-4">
              <h2 className="text-base font-black text-foreground uppercase tracking-wide">Get Access</h2>
              <div className="text-right">
                <p className="text-2xl font-black text-primary">$149</p>
                <p className="text-[11px] text-muted-foreground">per month · cancel anytime</p>
              </div>
            </div>
            <form onSubmit={handleSignup} className="space-y-3">
              <input
                value={signupForm.name} onChange={e => setSignupForm(f => ({...f, name: e.target.value}))}
                placeholder="Your name"
                className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
              />
              <input
                type="email" required value={signupForm.email} onChange={e => setSignupForm(f => ({...f, email: e.target.value}))}
                placeholder="Your email"
                className="w-full bg-background border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
              />
              <button type="submit" disabled={signingUp}
                className="w-full bg-primary text-white py-3 font-bold text-sm uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {signingUp ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                {signingUp ? "Processing…" : "Subscribe — $149/month →"}
              </button>
            </form>
            <p className="text-[11px] text-muted-foreground text-center mt-3">Questions? <a href="mailto:matt@m2training.com" className="text-primary">matt@m2training.com</a> or text <a href="tel:+13138064952" className="text-primary">(313) 806-4952</a></p>
          </div>
        </div>
      </div>
    </>
  );
}

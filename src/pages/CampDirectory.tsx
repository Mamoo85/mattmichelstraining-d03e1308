import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import SEOHead from "@/components/layout/SEOHead";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  CheckCircle, MapPin, Calendar, ArrowRight, Loader2,
  Globe, Users, Plus
} from "lucide-react";

const FALLBACK_LISTINGS = [
  { camp_name: "Elite QB Camp", sport: "Football", age_range: "12–18", location: "Grosse Pointe, MI", start_date: "2026-06-15", end_date: "2026-06-17", price_description: "$149 for the weekend", website_url: "#" },
  { camp_name: "Summer Hoops Academy", sport: "Basketball", age_range: "10–16", location: "Detroit, MI", start_date: "2026-07-07", end_date: "2026-07-11", price_description: "$199 per week", website_url: "#" },
  { camp_name: "Power Wrestling Camp", sport: "Wrestling", age_range: "8–17", location: "Sterling Heights, MI", start_date: "2026-06-22", end_date: "2026-06-24", price_description: "$125 for the weekend", website_url: "#" },
];

interface Listing {
  id?: string;
  camp_name: string;
  sport: string;
  age_range?: string;
  location?: string;
  start_date?: string;
  end_date?: string;
  price_description?: string;
  website_url?: string;
}

export default function CampDirectory() {
  const [searchParams] = useSearchParams();
  const isSuccess = searchParams.get("status") === "success";
  const [selectedSport, setSelectedSport] = useState<string>("All");
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    camp_name: "",
    sport: "",
    age_range: "",
    start_date: "",
    end_date: "",
    location: "",
    price_description: "",
    website_url: "",
    contact_email: "",
  });

  const { data: listings = [] } = useQuery<Listing[]>({
    queryKey: ["camp-directory-listings"],
    queryFn: async () => {
      const { data, error } = await (supabase.from("camp_directory_listings" as any) as any)
        .select("*")
        .eq("is_active", true)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  const displayListings: Listing[] = listings.length > 0 ? listings : FALLBACK_LISTINGS;
  const allSports = ["All", ...Array.from(new Set(displayListings.map(l => l.sport).filter(Boolean)))];
  const filtered = selectedSport === "All" ? displayListings : displayListings.filter(l => l.sport === selectedSport);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.camp_name || !form.contact_email) {
      toast.error("Camp name and contact email are required");
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-camp-listing-checkout", {
        body: form,
      });
      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      } else {
        throw new Error("No checkout URL returned");
      }
    } catch (err: any) {
      toast.error(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-[#0f0f1a] text-white flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <CheckCircle size={48} className="text-[#f97316] mx-auto mb-4" />
          <h1 className="text-2xl font-black mb-3">Listing Submitted!</h1>
          <p className="text-[#aaa] text-sm leading-relaxed">Your camp listing is under review and will go live within 24 hours after confirmation.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <SEOHead
        title="Youth Sports Camps in Michigan | Metro Detroit Camp Directory"
        description="Find youth sports camps in Metro Detroit and Michigan. Football, basketball, wrestling, and more. Ages 8–18. Updated weekly."
        path="/sports-camps"
      />
      <div className="min-h-screen bg-[#0f0f1a] text-white">

        {/* Hero */}
        <section className="pt-20 pb-12 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#f97316]/15 text-[#f97316] text-[11px] font-bold tracking-widest uppercase mb-6">
              <MapPin size={11} /> Michigan Youth Sports Camps
            </div>
            <h1 className="text-3xl sm:text-4xl font-black leading-tight mb-4">
              Find Youth Sports Camps<br />
              <span className="text-[#f97316]">in Michigan</span>
            </h1>
            <p className="text-base text-[#aaa] max-w-xl mx-auto">
              Football, basketball, wrestling, lacrosse and more. Camps updated weekly. Ages 8–18.
            </p>
          </div>
        </section>

        {/* Sport filters */}
        <section className="px-4 pb-6">
          <div className="max-w-4xl mx-auto flex flex-wrap gap-2 justify-center">
            {allSports.map(sport => (
              <button
                key={sport}
                onClick={() => setSelectedSport(sport)}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  selectedSport === sport
                    ? "bg-[#f97316] text-white"
                    : "bg-white/8 text-[#aaa] hover:bg-white/15"
                }`}
              >
                {sport}
              </button>
            ))}
          </div>
        </section>

        {/* Listings grid */}
        <section className="px-4 pb-16">
          <div className="max-w-4xl mx-auto">
            {filtered.length === 0 ? (
              <p className="text-center text-[#666] py-12">No camps found for this sport yet.</p>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {filtered.map((camp, i) => (
                  <div key={camp.id || i} className="bg-[#1a1a2e] border border-white/8 rounded-xl p-5 flex flex-col gap-3">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="font-bold text-sm leading-tight">{camp.camp_name}</h3>
                      {camp.sport && <Badge variant="secondary" className="text-[10px] shrink-0">{camp.sport}</Badge>}
                    </div>
                    {camp.age_range && (
                      <div className="flex items-center gap-1.5 text-xs text-[#888]">
                        <Users size={11} /> Ages {camp.age_range}
                      </div>
                    )}
                    {camp.location && (
                      <div className="flex items-center gap-1.5 text-xs text-[#888]">
                        <MapPin size={11} /> {camp.location}
                      </div>
                    )}
                    {(camp.start_date || camp.end_date) && (
                      <div className="flex items-center gap-1.5 text-xs text-[#888]">
                        <Calendar size={11} />
                        {camp.start_date && new Date(camp.start_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        {camp.start_date && camp.end_date && " – "}
                        {camp.end_date && new Date(camp.end_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </div>
                    )}
                    {camp.price_description && (
                      <div className="text-xs font-semibold text-[#f97316]">{camp.price_description}</div>
                    )}
                    {camp.website_url && camp.website_url !== "#" && (
                      <a
                        href={camp.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-[#f97316] hover:underline mt-auto"
                      >
                        <Globe size={11} /> Visit Website
                      </a>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* List your camp */}
        <section className="px-4 pb-24 border-t border-white/8">
          <div className="max-w-lg mx-auto pt-16">
            <div className="text-center mb-8">
              <h2 className="text-2xl font-bold mb-3">List Your Camp</h2>
              <p className="text-sm text-[#888]">Get your camp in front of 500+ youth sports families in Metro Detroit. $49/month — cancel anytime.</p>
            </div>

            {!showForm ? (
              <div className="text-center">
                <Button
                  className="bg-[#f97316] hover:bg-[#ea6c10] text-white font-bold px-8 py-5 text-base rounded-xl"
                  onClick={() => setShowForm(true)}
                >
                  <Plus size={16} className="mr-2" /> List My Camp — $49/mo
                </Button>
                <p className="text-xs text-[#666] mt-3">Your listing goes live within 24 hours after review.</p>
              </div>
            ) : (
              <Card className="bg-[#1a1a2e] border-white/10">
                <CardContent className="p-6 sm:p-8">
                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[#aaa] text-xs">Camp Name *</Label>
                        <Input value={form.camp_name} onChange={e => setForm(f => ({...f, camp_name: e.target.value}))} placeholder="Elite QB Camp" className="bg-white/5 border-white/15 text-white placeholder:text-[#555]" required />
                      </div>
                      <div>
                        <Label className="text-[#aaa] text-xs">Sport</Label>
                        <Input value={form.sport} onChange={e => setForm(f => ({...f, sport: e.target.value}))} placeholder="Football, Basketball, etc." className="bg-white/5 border-white/15 text-white placeholder:text-[#555]" />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[#aaa] text-xs">Age Range</Label>
                        <Input value={form.age_range} onChange={e => setForm(f => ({...f, age_range: e.target.value}))} placeholder="10–16" className="bg-white/5 border-white/15 text-white placeholder:text-[#555]" />
                      </div>
                      <div>
                        <Label className="text-[#aaa] text-xs">Location</Label>
                        <Input value={form.location} onChange={e => setForm(f => ({...f, location: e.target.value}))} placeholder="Grosse Pointe, MI" className="bg-white/5 border-white/15 text-white placeholder:text-[#555]" />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[#aaa] text-xs">Start Date</Label>
                        <Input type="date" value={form.start_date} onChange={e => setForm(f => ({...f, start_date: e.target.value}))} className="bg-white/5 border-white/15 text-white" />
                      </div>
                      <div>
                        <Label className="text-[#aaa] text-xs">End Date</Label>
                        <Input type="date" value={form.end_date} onChange={e => setForm(f => ({...f, end_date: e.target.value}))} className="bg-white/5 border-white/15 text-white" />
                      </div>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div>
                        <Label className="text-[#aaa] text-xs">Price</Label>
                        <Input value={form.price_description} onChange={e => setForm(f => ({...f, price_description: e.target.value}))} placeholder="$149 for the weekend" className="bg-white/5 border-white/15 text-white placeholder:text-[#555]" />
                      </div>
                      <div>
                        <Label className="text-[#aaa] text-xs">Website URL</Label>
                        <Input value={form.website_url} onChange={e => setForm(f => ({...f, website_url: e.target.value}))} placeholder="https://yourcamp.com" className="bg-white/5 border-white/15 text-white placeholder:text-[#555]" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[#aaa] text-xs">Contact Email *</Label>
                      <Input type="email" value={form.contact_email} onChange={e => setForm(f => ({...f, contact_email: e.target.value}))} placeholder="coach@yourcamp.com" className="bg-white/5 border-white/15 text-white placeholder:text-[#555]" required />
                    </div>
                    <Button type="submit" className="w-full bg-[#f97316] hover:bg-[#ea6c10] text-white font-bold py-5 text-base rounded-xl" disabled={loading}>
                      {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Processing...</> : "List My Camp — $49/mo →"}
                    </Button>
                    <p className="text-[10px] text-center text-[#555]">Secure payment via Stripe. Cancel anytime.</p>
                  </form>
                </CardContent>
              </Card>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

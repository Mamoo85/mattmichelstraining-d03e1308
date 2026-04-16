import { useParams } from "react-router-dom";
import { useState } from "react";
import SEOHead from "@/components/layout/SEOHead";
import { Phone, CheckCircle, Star, ArrowRight, MapPin, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const TERRITORY_DATA: Record<string, { trade: string; city: string; state: string; slug: string }> = {
  "hvac-detroit": { trade: "HVAC", city: "Detroit", state: "MI", slug: "hvac-detroit" },
  "hvac-warren": { trade: "HVAC", city: "Warren", state: "MI", slug: "hvac-warren" },
  "hvac-sterling-heights": { trade: "HVAC", city: "Sterling Heights", state: "MI", slug: "hvac-sterling-heights" },
  "hvac-dearborn": { trade: "HVAC", city: "Dearborn", state: "MI", slug: "hvac-dearborn" },
  "hvac-livonia": { trade: "HVAC", city: "Livonia", state: "MI", slug: "hvac-livonia" },
  "plumbing-detroit": { trade: "Plumbing", city: "Detroit", state: "MI", slug: "plumbing-detroit" },
  "plumbing-sterling-heights": { trade: "Plumbing", city: "Sterling Heights", state: "MI", slug: "plumbing-sterling-heights" },
  "plumbing-dearborn": { trade: "Plumbing", city: "Dearborn", state: "MI", slug: "plumbing-dearborn" },
  "plumbing-troy": { trade: "Plumbing", city: "Troy", state: "MI", slug: "plumbing-troy" },
  "plumbing-livonia": { trade: "Plumbing", city: "Livonia", state: "MI", slug: "plumbing-livonia" },
  "electrician-detroit": { trade: "Electrical", city: "Detroit", state: "MI", slug: "electrician-detroit" },
  "electrician-dearborn": { trade: "Electrical", city: "Dearborn", state: "MI", slug: "electrician-dearborn" },
  "electrician-warren": { trade: "Electrical", city: "Warren", state: "MI", slug: "electrician-warren" },
  "electrician-troy": { trade: "Electrical", city: "Troy", state: "MI", slug: "electrician-troy" },
  "electrician-livonia": { trade: "Electrical", city: "Livonia", state: "MI", slug: "electrician-livonia" },
  "roofing-detroit": { trade: "Roofing", city: "Detroit", state: "MI", slug: "roofing-detroit" },
  "roofing-warren": { trade: "Roofing", city: "Warren", state: "MI", slug: "roofing-warren" },
  "roofing-troy": { trade: "Roofing", city: "Troy", state: "MI", slug: "roofing-troy" },
  "roofing-southfield": { trade: "Roofing", city: "Southfield", state: "MI", slug: "roofing-southfield" },
  "roofing-livonia": { trade: "Roofing", city: "Livonia", state: "MI", slug: "roofing-livonia" },
};

const SERVICE_COPY: Record<string, { services: string[]; emergency: string; description: string }> = {
  HVAC: {
    services: ["Furnace repair & installation", "AC repair & installation", "Ductwork & ventilation", "Heat pump service", "Thermostat installation", "Emergency heating repair"],
    emergency: "Need emergency heating or cooling repair?",
    description: "heating, cooling, and HVAC",
  },
  Plumbing: {
    services: ["Drain cleaning & unclogging", "Water heater repair & install", "Pipe repair & replacement", "Sewer line service", "Fixture installation", "Emergency leak repair"],
    emergency: "Have a burst pipe or major leak?",
    description: "plumbing",
  },
  Electrical: {
    services: ["Panel upgrades & repairs", "Outlet & switch installation", "Lighting installation", "Electrical inspections", "Generator installation", "Emergency electrical repair"],
    emergency: "Electrical emergency? No power?",
    description: "electrical",
  },
  Roofing: {
    services: ["Roof repair & patching", "Full roof replacement", "Storm damage repair", "Gutter installation", "Roof inspection", "Emergency tarp & leak stop"],
    emergency: "Storm damage or active roof leak?",
    description: "roofing",
  },
};

export default function ContractorTerritory() {
  const { slug } = useParams<{ slug: string }>();
  const { toast } = useToast();
  const [form, setForm] = useState({ name: "", phone: "", email: "", message: "", project_type: "" });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const territory = slug ? TERRITORY_DATA[slug] : null;
  if (!territory) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Territory not found.</div>;
  }

  const copy = SERVICE_COPY[territory.trade] || SERVICE_COPY["HVAC"];
  const pageTitle = `${territory.trade} ${territory.city} ${territory.state} | Licensed ${territory.trade} Contractors`;
  const pageDesc = `Need ${copy.description} service in ${territory.city}, ${territory.state}? Get a free quote from a licensed, local contractor. Fast response — call or fill out the form.`;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name || !form.phone) {
      toast({ title: "Name and phone are required", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("contractor-lead-capture", {
        body: {
          site_slug: territory.slug,
          name: form.name,
          phone: form.phone,
          email: form.email || undefined,
          message: form.message || undefined,
          project_type: form.project_type || territory.trade,
          source: "seo_page",
        },
      });
      if (error) throw error;
      setSubmitted(true);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      toast({ title: "Something went wrong", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <>
        <SEOHead title={pageTitle} description={pageDesc} />
        <div className="min-h-screen bg-background flex items-center justify-center px-6">
          <div className="max-w-md text-center">
            <CheckCircle size={48} className="text-green-500 mx-auto mb-4" />
            <h1 className="text-2xl font-black text-foreground mb-2">Request received!</h1>
            <p className="text-muted-foreground text-sm leading-relaxed">
              A licensed {territory.trade.toLowerCase()} contractor in {territory.city} will contact you shortly. For immediate help, call <a href="tel:+13139921219" className="text-primary font-bold">(313) 992-1219</a>.
            </p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <SEOHead title={pageTitle} description={pageDesc} />
      <div className="min-h-screen bg-background text-foreground">
        {/* Hero */}
        <div className="bg-[#1e293b] text-white px-6 py-14 text-center">
          <div className="flex items-center justify-center gap-2 mb-3">
            <MapPin size={16} className="text-primary" />
            <p className="text-[11px] font-bold uppercase tracking-widest text-primary">{territory.city}, {territory.state}</p>
          </div>
          <h1 className="text-3xl font-black mb-3 leading-tight">
            {territory.trade} Service in {territory.city}, {territory.state}
          </h1>
          <p className="text-slate-300 text-base max-w-lg mx-auto leading-relaxed">
            Licensed, local {territory.trade.toLowerCase()} contractors ready to help. Get a free quote — fast response guaranteed.
          </p>
          <div className="mt-5 flex flex-col sm:flex-row gap-3 justify-center">
            <a href="tel:+13139921219" className="bg-primary hover:bg-primary/90 text-white px-6 py-3 font-bold text-sm transition-all inline-flex items-center justify-center gap-2">
              <Phone size={14} /> Call Now — (313) 992-1219
            </a>
            <button
              onClick={() => document.getElementById("lead-form")?.scrollIntoView({ behavior: "smooth" })}
              className="border border-white/30 text-white px-6 py-3 font-bold text-sm hover:bg-white/10 transition-all inline-flex items-center justify-center gap-2"
            >
              Get Free Quote <ArrowRight size={14} />
            </button>
          </div>
        </div>

        <div className="max-w-3xl mx-auto px-6 py-12">
          {/* Services */}
          <h2 className="text-lg font-black text-foreground mb-4 uppercase tracking-wide">{territory.trade} services in {territory.city}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
            {copy.services.map((s) => (
              <div key={s} className="flex items-start gap-3 p-3 bg-card border border-border rounded">
                <CheckCircle size={16} className="text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-foreground">{s}</p>
              </div>
            ))}
          </div>

          {/* Trust signals */}
          <div className="grid grid-cols-3 gap-4 mb-10">
            <div className="text-center p-4 bg-card border border-border rounded">
              <Star size={20} className="text-yellow-500 mx-auto mb-1" />
              <p className="font-bold text-sm text-foreground">Licensed</p>
              <p className="text-[11px] text-muted-foreground">State of Michigan</p>
            </div>
            <div className="text-center p-4 bg-card border border-border rounded">
              <Clock size={20} className="text-primary mx-auto mb-1" />
              <p className="font-bold text-sm text-foreground">Fast Response</p>
              <p className="text-[11px] text-muted-foreground">Same-day available</p>
            </div>
            <div className="text-center p-4 bg-card border border-border rounded">
              <CheckCircle size={20} className="text-green-500 mx-auto mb-1" />
              <p className="font-bold text-sm text-foreground">Free Quotes</p>
              <p className="text-[11px] text-muted-foreground">No obligation</p>
            </div>
          </div>

          {/* Emergency callout */}
          <div className="bg-red-950/20 border border-red-900/30 p-5 rounded mb-10 text-center">
            <p className="font-bold text-foreground mb-1">{copy.emergency}</p>
            <a href="tel:+13139921219" className="text-primary font-bold text-lg hover:underline">(313) 992-1219</a>
            <p className="text-[11px] text-muted-foreground mt-1">Available 24/7 for emergencies</p>
          </div>

          {/* Lead capture form */}
          <div id="lead-form" className="bg-[#1e293b] border border-slate-600 rounded-xl p-6 mb-10">
            <h3 className="text-lg font-black text-white mb-1">Get a free {territory.trade.toLowerCase()} quote</h3>
            <p className="text-sm text-slate-400 mb-4">Fill out the form and a local contractor will contact you within minutes.</p>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="text"
                placeholder="Your name *"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                required
                className="w-full bg-slate-800 border border-slate-600 text-white px-4 py-3 text-sm rounded placeholder:text-slate-500"
              />
              <input
                type="tel"
                placeholder="Phone number *"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                required
                className="w-full bg-slate-800 border border-slate-600 text-white px-4 py-3 text-sm rounded placeholder:text-slate-500"
              />
              <input
                type="email"
                placeholder="Email (optional)"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 text-white px-4 py-3 text-sm rounded placeholder:text-slate-500"
              />
              <select
                value={form.project_type}
                onChange={(e) => setForm((f) => ({ ...f, project_type: e.target.value }))}
                className="w-full bg-slate-800 border border-slate-600 text-white px-4 py-3 text-sm rounded"
              >
                <option value="">What do you need help with?</option>
                {copy.services.map((s) => <option key={s} value={s}>{s}</option>)}
                <option value="Other">Other</option>
              </select>
              <textarea
                placeholder="Tell us more about your project (optional)"
                value={form.message}
                onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
                rows={3}
                className="w-full bg-slate-800 border border-slate-600 text-white px-4 py-3 text-sm rounded placeholder:text-slate-500 resize-none"
              />
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3 px-6 rounded text-sm transition-all disabled:opacity-50"
              >
                {loading ? "Submitting..." : "Get My Free Quote"}
              </button>
              <p className="text-center text-[11px] text-slate-500">No spam. A local contractor will call you directly.</p>
            </form>
          </div>

          {/* SEO content */}
          <div className="prose prose-sm prose-slate dark:prose-invert max-w-none mb-10">
            <h2>Why choose a local {territory.trade.toLowerCase()} contractor in {territory.city}?</h2>
            <p>
              When you need {copy.description} service in {territory.city}, {territory.state}, you want someone who knows the area,
              responds fast, and does quality work. Our network connects you with licensed, insured {territory.trade.toLowerCase()} professionals
              who live and work in {territory.city}. No call centers. No out-of-state companies. Just local contractors who take pride in their work.
            </p>
            <p>
              Every contractor in our network is vetted, licensed in the State of Michigan, and committed to fair pricing with upfront quotes.
              Fill out the form above or call <a href="tel:+13139921219">(313) 992-1219</a> to get connected today.
            </p>
          </div>

          {/* Footer CTA */}
          <div className="text-center py-8 border-t border-border">
            <p className="text-sm text-muted-foreground mb-2">Serving {territory.city} and surrounding areas</p>
            <a href="tel:+13139921219" className="text-primary font-bold text-sm hover:underline inline-flex items-center gap-1">
              <Phone size={14} /> (313) 992-1219
            </a>
          </div>
        </div>
      </div>
    </>
  );
}

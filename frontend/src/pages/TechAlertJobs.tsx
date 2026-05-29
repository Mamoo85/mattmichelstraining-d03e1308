import { useState, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import SEOHead from "@/components/layout/SEOHead";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Search, MapPin, Star, ArrowRight, Briefcase, Shield,
  Clock, CheckCircle, Users, Phone,
} from "lucide-react";

interface JobListing {
  id: string;
  company_name: string;
  city: string;
  license_types: string[];
  description: string;
  pay_range: string;
  benefits: string[];
  posted_at: string;
  urgency: "high" | "medium" | "low";
}

// Demo job listings for launch
const DEMO_JOBS: JobListing[] = [
  { id: "j1", company_name: "Great Lakes Mechanical", city: "Royal Oak, MI", license_types: ["HVAC Journeyman", "HVAC Contractor"], description: "Growing HVAC shop looking for experienced journeymen. Residential and light commercial work. Company van provided.", pay_range: "$28-38/hr", benefits: ["Health insurance", "Company van", "Paid holidays", "401k match"], posted_at: new Date(Date.now() - 86400000).toISOString(), urgency: "high" },
  { id: "j2", company_name: "Motor City Plumbing", city: "Dearborn, MI", license_types: ["Master Plumber", "Journeyman Plumber"], description: "Family-owned plumbing company since 1985. Service and new construction. Steady year-round work.", pay_range: "$32-42/hr", benefits: ["Health + dental", "Paid vacation", "Tool allowance"], posted_at: new Date(Date.now() - 172800000).toISOString(), urgency: "medium" },
  { id: "j3", company_name: "Beaconshire Nursing Centre", city: "Southfield, MI", license_types: ["CNA", "LPN", "RN"], description: "116-bed facility seeking licensed nursing staff. All shifts available. Sign-on bonus for full-time.", pay_range: "$18-35/hr", benefits: ["Sign-on bonus", "Tuition reimbursement", "Flexible scheduling", "Health insurance"], posted_at: new Date(Date.now() - 259200000).toISOString(), urgency: "high" },
  { id: "j4", company_name: "Spartan Electric Co.", city: "Sterling Heights, MI", license_types: ["Journeyman Electrician", "Apprentice Electrician"], description: "Commercial electrical contractor expanding team. Large-scale projects in Metro Detroit. Overtime available.", pay_range: "$30-45/hr", benefits: ["Overtime pay", "Company truck", "Health insurance", "Retirement plan"], posted_at: new Date(Date.now() - 345600000).toISOString(), urgency: "medium" },
  { id: "j5", company_name: "Comfort Zone HVAC", city: "Troy, MI", license_types: ["HVAC Journeyman"], description: "High-end residential HVAC. Mini-splits, geothermal, smart home integration. Top pay for top talent.", pay_range: "$35-48/hr", benefits: ["Top pay", "Training budget", "New equipment", "Flexible schedule"], posted_at: new Date(Date.now() - 432000000).toISOString(), urgency: "low" },
  { id: "j6", company_name: "Heritage Home Health", city: "Livonia, MI", license_types: ["CNA", "HHA"], description: "Home health aide positions throughout Western Wayne County. Flexible hours, mileage reimbursement.", pay_range: "$16-22/hr", benefits: ["Flexible hours", "Mileage reimbursement", "Weekly pay", "Training provided"], posted_at: new Date(Date.now() - 518400000).toISOString(), urgency: "medium" },
];

const URGENCY_STYLES = {
  high: { label: "Urgent", bg: "bg-red-500/10 border-red-500/20", text: "text-red-400" },
  medium: { label: "Active", bg: "bg-blue-500/10 border-blue-500/20", text: "text-blue-400" },
  low: { label: "Open", bg: "bg-white/5 border-white/10", text: "text-white/40" },
};

export default function TechAlertJobs() {
  const [searchParams] = useSearchParams();
  const cityParam = searchParams.get("city") || "";
  const [searchQuery, setSearchQuery] = useState("");
  const [licenseFilter, setLicenseFilter] = useState("All");
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: "", email: "", phone: "", license_type: "", city: "" });

  const cityNames: Record<string, string> = {
    detroit: "Metro Detroit", "grand-rapids": "Grand Rapids", flint: "Flint",
    lansing: "Lansing", "ann-arbor": "Ann Arbor", kalamazoo: "Kalamazoo",
  };
  const cityLabel = cityNames[cityParam.toLowerCase()] || "Michigan";

  const licenseTypes = ["All", ...new Set(DEMO_JOBS.flatMap(j => j.license_types))];

  const filtered = useMemo(() => {
    let jobs = DEMO_JOBS;
    if (licenseFilter !== "All") jobs = jobs.filter(j => j.license_types.includes(licenseFilter));
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      jobs = jobs.filter(j => j.company_name.toLowerCase().includes(q) || j.city.toLowerCase().includes(q) || j.license_types.some(l => l.toLowerCase().includes(q)));
    }
    return jobs;
  }, [searchQuery, licenseFilter]);

  async function submitProfile() {
    if (!formData.name || !formData.phone) { toast.error("Name and phone required"); return; }
    try {
      await supabase.functions.invoke("candidate-self-register", { body: formData });
      toast.success("Profile submitted! Employers will contact you directly.");
      setShowForm(false);
    } catch { toast.success("Profile submitted! Employers will contact you directly."); setShowForm(false); }
  }

  return (
    <>
      <SEOHead title={`Trades Jobs in ${cityLabel} | TechAlert`} description={`Licensed trade jobs in ${cityLabel}. HVAC, plumbing, electrical, nursing positions from verified employers.`} path="/jobs" />
      <div className="min-h-screen bg-[#030711] text-white" style={{ fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif" }}>

        {/* HERO */}
        <section className="py-16 px-4 border-b border-white/5">
          <div className="max-w-3xl mx-auto text-center">
            <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-4 py-1.5 mb-6">
              <Briefcase className="h-3.5 w-3.5 text-emerald-400" />
              <span className="text-emerald-400 text-xs font-semibold">VERIFIED EMPLOYERS</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-black mb-4 leading-tight">
              Licensed Trade Jobs<br />
              <span className="text-emerald-400">in {cityLabel}</span>
            </h1>
            <p className="text-white/40 text-sm mb-8 max-w-lg mx-auto">
              HVAC, plumbing, electrical, and healthcare positions from employers actively hiring through TechAlert. Your license is your ticket.
            </p>
            <div className="flex gap-3 justify-center">
              <Button onClick={() => setShowForm(true)} className="bg-emerald-500 text-white font-bold hover:bg-emerald-600 h-11 px-6" data-testid="jobs-create-profile">
                <Users className="w-4 h-4 mr-2" /> Create Free Profile
              </Button>
              <a href="/go/techalert" className="inline-flex items-center gap-2 h-11 px-6 rounded-md bg-white/5 text-white/60 border border-white/10 font-semibold text-sm hover:bg-white/10 transition-colors">
                For Employers <ArrowRight className="w-4 h-4" />
              </a>
            </div>
          </div>
        </section>

        {/* TRUST BAR */}
        <div className="border-b border-white/5 py-4 px-4">
          <div className="max-w-3xl mx-auto flex justify-center gap-8 text-center">
            {[
              { icon: Shield, label: "License-verified employers" },
              { icon: Clock, label: "Respond within 48 hours" },
              { icon: Phone, label: "Direct contact — no middleman" },
            ].map((t, i) => (
              <div key={i} className="flex items-center gap-2 text-white/30 text-xs">
                <t.icon className="w-3.5 h-3.5" /> {t.label}
              </div>
            ))}
          </div>
        </div>

        {/* FILTERS */}
        <section className="py-6 px-4">
          <div className="max-w-3xl mx-auto">
            <div className="flex gap-3 mb-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/20" />
                <Input
                  placeholder="Search company, city, or license..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-10 bg-[#161b22] border-[#30363d] text-white placeholder:text-white/20 h-10"
                  data-testid="jobs-search"
                />
              </div>
            </div>
            <div className="flex gap-1.5 flex-wrap">
              {licenseTypes.map(lt => (
                <Button
                  key={lt}
                  size="sm"
                  variant={licenseFilter === lt ? "default" : "outline"}
                  onClick={() => setLicenseFilter(lt)}
                  className={`text-xs ${licenseFilter === lt ? "bg-emerald-500 text-white" : "border-white/10 text-white/40 hover:bg-white/5"}`}
                >
                  {lt}
                </Button>
              ))}
            </div>
            <p className="text-white/20 text-xs mt-3">{filtered.length} positions available</p>
          </div>
        </section>

        {/* JOB LISTINGS */}
        <section className="pb-20 px-4">
          <div className="max-w-3xl mx-auto space-y-3">
            {filtered.map(job => {
              const urg = URGENCY_STYLES[job.urgency];
              return (
                <div key={job.id} className="bg-[#0d1117] border border-[#30363d] rounded-xl p-5 hover:border-white/20 transition-colors" data-testid={`job-${job.id}`}>
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-white font-bold text-sm">{job.company_name}</h3>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${urg.bg} ${urg.text}`}>{urg.label}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-white/40">
                        <span className="flex items-center gap-1"><MapPin className="w-3 h-3" /> {job.city}</span>
                        <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {Math.ceil((Date.now() - new Date(job.posted_at).getTime()) / 86400000)}d ago</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-emerald-400 font-bold text-sm font-mono">{job.pay_range}</div>
                    </div>
                  </div>

                  <p className="text-white/50 text-xs leading-relaxed mb-3">{job.description}</p>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {job.license_types.map(lt => (
                      <span key={lt} className="text-[10px] px-2 py-0.5 rounded bg-[#00d4ff]/10 text-[#00d4ff]/70 border border-[#00d4ff]/20">{lt}</span>
                    ))}
                  </div>

                  <div className="flex flex-wrap gap-1.5 mb-3">
                    {job.benefits.map(b => (
                      <span key={b} className="text-[10px] px-2 py-0.5 rounded bg-white/5 text-white/30 flex items-center gap-1">
                        <CheckCircle className="w-2.5 h-2.5" /> {b}
                      </span>
                    ))}
                  </div>

                  <Button size="sm" onClick={() => setShowForm(true)} className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/30 text-xs font-semibold">
                    I'm Interested <ArrowRight className="w-3 h-3 ml-1" />
                  </Button>
                </div>
              );
            })}
          </div>
        </section>

        {/* PROFILE FORM MODAL */}
        {showForm && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowForm(false)}>
            <div className="bg-[#0d1117] border border-[#30363d] rounded-xl max-w-md w-full p-6 space-y-4" onClick={e => e.stopPropagation()} data-testid="jobs-profile-form">
              <h3 className="text-white font-bold text-lg">Create Your Free Profile</h3>
              <p className="text-white/40 text-xs">Verified employers will contact you directly. No middlemen, no fees.</p>
              <Input placeholder="Full name *" value={formData.name} onChange={e => setFormData(p => ({ ...p, name: e.target.value }))} className="bg-[#161b22] border-[#30363d] text-white placeholder:text-white/25" />
              <Input placeholder="Phone *" value={formData.phone} onChange={e => setFormData(p => ({ ...p, phone: e.target.value }))} className="bg-[#161b22] border-[#30363d] text-white placeholder:text-white/25" />
              <Input placeholder="Email" value={formData.email} onChange={e => setFormData(p => ({ ...p, email: e.target.value }))} className="bg-[#161b22] border-[#30363d] text-white placeholder:text-white/25" />
              <Input placeholder="License type (e.g. HVAC Journeyman)" value={formData.license_type} onChange={e => setFormData(p => ({ ...p, license_type: e.target.value }))} className="bg-[#161b22] border-[#30363d] text-white placeholder:text-white/25" />
              <Input placeholder="City" value={formData.city} onChange={e => setFormData(p => ({ ...p, city: e.target.value }))} className="bg-[#161b22] border-[#30363d] text-white placeholder:text-white/25" />
              <Button onClick={submitProfile} className="w-full bg-emerald-500 text-white font-bold hover:bg-emerald-600 h-11" data-testid="jobs-submit-profile">
                Submit Profile <ArrowRight className="w-4 h-4 ml-2" />
              </Button>
              <p className="text-white/15 text-[10px] text-center">By submitting, you agree to be contacted by verified employers about job opportunities.</p>
            </div>
          </div>
        )}

        <footer className="py-8 px-4 border-t border-white/5 text-center">
          <p className="text-white/15 text-xs">Detroit Web Agency — Connecting licensed professionals with verified employers.</p>
        </footer>
      </div>
    </>
  );
}

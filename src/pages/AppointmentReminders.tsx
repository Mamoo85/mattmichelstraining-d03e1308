import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CheckCircle, Loader2, ArrowRight, Bell, Clock, MessageSquare, Plug } from "lucide-react";

const BENEFITS = [
  { icon: Bell, label: "Reduce no-shows by 80%", sub: "Automated reminders keep your schedule full and your revenue steady" },
  { icon: Clock, label: "24hr + 1hr reminders", sub: "Two-touch system ensures customers remember their appointment" },
  { icon: MessageSquare, label: "Personalized messages", sub: "AI writes friendly, on-brand texts with the customer's name and details" },
  { icon: Plug, label: "Works with any scheduling", sub: "No special software needed — works with Google Calendar, Calendly, or manual bookings" },
];

const STEPS = [
  { num: "1", title: "Sign up", desc: "Enter your business info and we connect your scheduling system." },
  { num: "2", title: "AI sends texts", desc: "Customers get personalized reminders 24 hours and 1 hour before their appointment." },
  { num: "3", title: "Fewer no-shows", desc: "Watch your no-show rate drop and your revenue climb." },
];

export default function AppointmentReminders() {
  const [form, setForm] = useState({
    name: "",
    businessName: "",
    email: "",
    phone: "",
  });
  const [submitting, setSubmitting] = useState(false);

  const success = new URLSearchParams(window.location.search).get("status") === "success";

  if (success) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center px-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-500" />
          </div>
          <h1 className="text-2xl font-black text-white mb-3">You're all set.</h1>
          <p className="text-slate-400 leading-relaxed">Matt will reach out within 24 hours to connect your scheduling and get reminders running.</p>
          <p className="mt-4 text-sm text-slate-500">Questions? <a href="tel:+13138064952" className="text-cyan-500">(313) 806-4952</a></p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.businessName) {
      toast.error("Business name and email are required");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-appointment-reminder-checkout", {
        body: { ...form },
      });
      if (error) throw error;
      if (data?.url) window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message || "Something went wrong");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Hero */}
      <div className="bg-[#0a1628] text-white px-6 py-16 text-center border-b border-slate-800">
        <p className="inline-block text-[11px] font-bold uppercase tracking-widest text-cyan-400 bg-cyan-500/10 px-3 py-1 rounded-full mb-4">Appointment Reminder SMS</p>
        <h1 className="text-3xl md:text-4xl font-black mb-4 leading-tight">
          Stop losing money to no-shows.
        </h1>
        <p className="text-slate-300 text-sm max-w-xl mx-auto leading-relaxed mb-4">
          AI sends personalized text reminders 24 hours and 1 hour before every appointment. Your customers show up, your schedule stays full.
        </p>
        <p className="text-2xl font-black text-cyan-400">$39<span className="text-sm font-normal text-slate-400">/month</span></p>
        <p className="text-[12px] text-slate-400 mt-1">7-day free trial. Cancel anytime.</p>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-12">
        {/* Benefits */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-12">
          {BENEFITS.map(({ icon: Icon, label, sub }) => (
            <div key={label} className="bg-slate-800/50 border border-slate-700 p-5">
              <Icon size={20} className="text-cyan-500 mb-3" />
              <p className="font-bold text-sm text-white mb-1">{label}</p>
              <p className="text-[12px] text-slate-400">{sub}</p>
            </div>
          ))}
        </div>

        {/* How it works */}
        <h2 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-4">How it works</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-12">
          {STEPS.map(({ num, title, desc }) => (
            <div key={num} className="text-center">
              <div className="w-10 h-10 rounded-full bg-cyan-500 text-white font-black flex items-center justify-center mx-auto mb-3">{num}</div>
              <p className="font-bold text-sm text-white mb-1">{title}</p>
              <p className="text-[12px] text-slate-400">{desc}</p>
            </div>
          ))}
        </div>

        {/* Sign-up form */}
        <div className="bg-slate-800/50 border border-slate-700 p-6 mb-10">
          <h2 className="text-sm font-black uppercase tracking-widest text-white mb-4">
            Get Started — $39/month
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Your Name</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="John Smith"
                  className="w-full bg-[#0a0a0f] border border-slate-700 text-white px-3 py-2.5 text-sm focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Business Name *</label>
                <input
                  required
                  value={form.businessName}
                  onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))}
                  placeholder="Smith Plumbing Co."
                  className="w-full bg-[#0a0a0f] border border-slate-700 text-white px-3 py-2.5 text-sm focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Email *</label>
                <input
                  type="email"
                  required
                  value={form.email}
                  onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="you@business.com"
                  className="w-full bg-[#0a0a0f] border border-slate-700 text-white px-3 py-2.5 text-sm focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold uppercase tracking-widest text-slate-400 block mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                  placeholder="(313) 555-0100"
                  className="w-full bg-[#0a0a0f] border border-slate-700 text-white px-3 py-2.5 text-sm focus:ring-1 focus:ring-cyan-500 outline-none"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="w-full bg-cyan-500 hover:bg-cyan-600 text-white py-3 font-bold text-sm uppercase tracking-widest disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
              {submitting ? "Processing..." : "Start Free Trial — $39/mo"}
            </button>
            <p className="text-[11px] text-slate-500 text-center">Secure checkout via Stripe. 7-day free trial. Cancel anytime.</p>
          </form>
        </div>

        {/* Founder credibility */}
        <div className="bg-slate-800/50 border border-slate-700 p-5 mb-10 flex items-start gap-4">
          <img src="/images/matt-boat.jpg" alt="Matt Michels" className="w-[72px] h-[72px] rounded-full object-cover flex-shrink-0" />
          <p className="text-[13px] text-slate-400 leading-relaxed">
            <span className="font-bold text-white">Matt Michels — Grosse Pointe, MI.</span>{" "}
            I built this after watching local businesses lose thousands every month to no-shows. A simple text reminder changes everything.
          </p>
        </div>

        <p className="text-[12px] text-slate-500 text-center">
          Questions? Email <a href="mailto:matt@mattmichelstraining.com" className="text-cyan-500">matt@mattmichelstraining.com</a> or text <a href="tel:+13138064952" className="text-cyan-500">(313) 806-4952</a>
        </p>
      </div>
    </div>
  );
}

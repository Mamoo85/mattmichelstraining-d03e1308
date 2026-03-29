import React from 'react';
import { MessageCircle, Calendar, CheckCircle, ArrowRight, ShieldCheck, Users } from 'lucide-react';

export default function AthleteBlueprint() {
  return (
    <div className="min-h-screen bg-[#111110] text-slate-200 font-sans selection:bg-[#e8621a]/30">
      
      {/* Urgency Banner */}
      <div className="bg-red-600 text-white text-xs md:text-sm font-bold text-center py-2 px-4 tracking-wide">
        🔥 Spring Break Special — First session this week · Add a sibling FREE for Month 1 · Only 6 spots available
      </div>

      {/* Minimal Header */}
      <header className="flex justify-between items-center px-6 py-4 max-w-5xl mx-auto">
        <div className="text-2xl font-black tracking-tighter text-white">
          M<span className="text-[#e8621a]">²</span>
        </div>
        <a href="sms:3138064952" className="text-sm font-bold text-slate-300 hover:text-white transition-colors flex items-center gap-2">
          <MessageCircle size={16} className="text-[#e8621a]" />
          Text Matt: 313-806-4952
        </a>
      </header>

      {/* Hero */}
      <section className="px-6 py-20 max-w-4xl mx-auto text-center">
        <p className="text-[#e8621a] font-bold uppercase tracking-[0.2em] text-sm mb-4">
          Grosse Pointe's Only 1-on-1 Youth Strength Program
        </p>
        <h1 className="text-4xl md:text-6xl font-black text-white leading-[1.1] mb-6">
          Your Kid Gets Stronger.<br />
          <span className="text-[#e8621a]">You See Every Rep.</span>
        </h1>
        <p className="text-lg text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
          Matt Michel has 20 years of experience turning young athletes into college-ready competitors.
          Every session is tracked. Every parent stays informed. No guesswork.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <a href="/schedule" className="bg-[#e8621a] hover:bg-[#d4570f] text-white font-black py-4 px-8 rounded-lg text-lg transition-colors flex items-center justify-center gap-2">
            <Calendar size={20} />
            Book the First Session — $40
          </a>
          <a href="sms:3138064952" className="border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-bold py-4 px-8 rounded-lg text-lg transition-colors text-center">
            Text Matt a Question
          </a>
        </div>
      </section>

      {/* Social Proof Strip */}
      <div className="bg-[#0d0d0d] py-6 border-y border-white/5">
        <div className="max-w-4xl mx-auto flex flex-wrap justify-center gap-8 text-center">
          {[
            { stat: "50+", label: "College Athletes Developed" },
            { stat: "20", label: "Years Experience" },
            { stat: "0", label: "Training Injuries" },
            { stat: "4.9★", label: "Parent Rating" },
          ].map((item, i) => (
            <div key={i}>
              <p className="text-2xl font-black text-[#e8621a]">{item.stat}</p>
              <p className="text-xs text-slate-500 uppercase tracking-widest">{item.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Parent Value Prop */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto grid md:grid-cols-2 gap-12">
          
          {/* For Parents */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <Users className="text-[#e8621a]" size={24} />
              <h2 className="text-2xl font-black text-white">For Parents</h2>
            </div>
            <p className="text-slate-400 mb-6 leading-relaxed">
              You'll never wonder "what did they do today?" again. The M² app gives you a live
              dashboard showing every workout, every weight lifted, and coach notes after each session.
            </p>
            <div className="grid grid-cols-2 gap-4 mb-8">
              <a href="/schedule" className="bg-[#e8621a] hover:bg-[#d4570f] text-white font-black py-3 rounded-lg text-center transition-colors">
                Book First Session
              </a>
              <a href="/schedule" className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 rounded-lg text-center transition-colors border border-white/10">
                Claim the Sibling Offer
              </a>
            </div>

            {/* Deliverables Card */}
            <div className="bg-[#1a1a1a] border-l-4 border-[#e8621a] p-8 rounded-r-2xl shadow-xl">
              <h3 className="text-2xl font-black text-white mb-6">What $150/Month Gets You</h3>
              <ul className="space-y-4">
                {[
                  "1 in-person session with Coach Matt per month",
                  "Custom 3-day-per-week program in the M² app",
                  "Every workout logged and reviewed by Coach Matt",
                  "Parent dashboard — see every session, PR, and note",
                  "24/7 direct messaging for athlete AND parent",
                  "Program updated monthly based on progress",
                  "No contract — cancel anytime"
                ].map((item, i) => (
                  <li key={i} className="flex items-start gap-3">
                    <CheckCircle className="text-[#e8621a] shrink-0 mt-0.5" size={20} />
                    <span className="text-slate-300 text-lg">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* For Athletes */}
          <div>
            <div className="flex items-center gap-3 mb-4">
              <ArrowRight className="text-[#e8621a]" size={24} />
              <h2 className="text-2xl font-black text-white">For Athletes</h2>
            </div>
            <p className="text-slate-400 mb-6 leading-relaxed">
              This isn't gym class. You get a real program, real coaching, and a system that tracks your
              progress over months and years — the same way college athletes train.
            </p>
            <div className="space-y-4">
              {[
                {
                  title: "Your Own Program",
                  desc: "Built for your sport, your body, your goals. Updated every month."
                },
                {
                  title: "Track Every PR",
                  desc: "See your numbers go up over time. Bench, squat, deadlift — all tracked."
                },
                {
                  title: "Ask Coach Anything",
                  desc: "Direct message Matt anytime. Form checks, nutrition questions, game prep."
                },
                {
                  title: "Earn Your Level",
                  desc: "Rookie → Grinder → Competitor → Beast → Legend. Every rep counts."
                }
              ].map((item, i) => (
                <div key={i} className="bg-[#1a1a1a] rounded-xl p-5 border border-white/5">
                  <h4 className="font-black text-white mb-1">{item.title}</h4>
                  <p className="text-slate-400 text-sm">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonial */}
      <section className="px-6 py-16 bg-[#0d0d0d]">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xl md:text-2xl text-slate-300 italic leading-relaxed mb-6">
            "Matt changed our son's trajectory. He went from a kid who hated the weight room to a
            starter who earned a college offer. The parent dashboard let us see everything — we were
            never in the dark."
          </p>
          <p className="text-[#e8621a] font-bold">— Parent of D2 Football Recruit, GP South '24</p>
        </div>
      </section>

      {/* How It Works */}
      <section className="px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-black text-white text-center mb-12">How It Works</h2>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "01",
                title: "Text Matt",
                desc: "Send a text to 313-806-4952. Tell him your kid's sport, age, and goals. He'll respond personally."
              },
              {
                step: "02",
                title: "First Session ($40)",
                desc: "Matt assesses movement, builds the plan, and your athlete gets their first real workout."
              },
              {
                step: "03",
                title: "Program Starts",
                desc: "Your kid gets a custom program in the app. You get the parent dashboard. Matt reviews every log."
              }
            ].map((item, i) => (
              <div key={i} className="text-center">
                <p className="text-4xl font-black text-[#e8621a] mb-3">{item.step}</p>
                <h3 className="text-xl font-black text-white mb-2">{item.title}</h3>
                <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="px-6 py-20 bg-gradient-to-b from-[#111110] to-[#0d0d0d]">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
            6 Spots Left This Spring
          </h2>
          <p className="text-slate-400 mb-8 text-lg">
            Matt only takes on athletes he can personally coach. Once the roster is full, it's full.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a href="/schedule" className="bg-[#e8621a] hover:bg-[#d4570f] text-white font-black py-4 px-10 rounded-lg text-lg transition-colors">
              Book the First Session — $40
            </a>
            <a href="sms:3138064952" className="border border-slate-600 hover:border-slate-400 text-slate-300 hover:text-white font-bold py-4 px-10 rounded-lg text-lg transition-colors">
              Text Matt First
            </a>
          </div>
        </div>
      </section>

      {/* Credentials Strip */}
      <section className="px-6 py-12 bg-[#0a0a0a]">
        <div className="max-w-4xl mx-auto text-center">
          <div className="flex justify-center mb-6">
            <ShieldCheck className="text-slate-600" size={40} />
          </div>
          <p className="text-slate-300 font-bold uppercase tracking-[0.15em] leading-loose text-sm md:text-base">
            20 Years Experience <span className="text-slate-600 px-2">|</span> 
            50+ College Athletes Developed <span className="text-slate-600 px-2">|</span> 
            Teams Trained at GP South <span className="text-slate-600 px-2">|</span> 
            Zero Training Injuries <span className="text-slate-600 px-2">|</span> 
            Grosse Pointe Native
          </p>
          <a href="https://grossepointenews.com" target="_blank" rel="noopener noreferrer" className="text-[#e8621a] hover:text-[#d4570f] text-sm font-bold mt-4 inline-block transition-colors">
            Read the feature in the Grosse Pointe News →
          </a>
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center py-12 text-slate-600 text-sm border-t border-white/5 mt-12">
        <p>© {new Date().getFullYear()} M² Training · Grosse Pointe, MI · mattmichelstraining.com · 313-806-4952</p>
      </footer>
    </div>
  );
}

import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toastSuccess, toastError } from "@/lib/toast";
import {
  CheckCircle2, ChevronRight, ChevronLeft, Loader2, Sparkles,
  MapPin, Briefcase, Bell, Zap,
} from "lucide-react";
import SEOHead from "@/components/layout/SEOHead";

const TRADE_OPTIONS = [
  { id: "hvac_tech",       label: "HVAC Tech",       emoji: "🔥" },
  { id: "boiler_operator", label: "Boiler Operator", emoji: "♨️" },
  { id: "plumber",         label: "Plumber",         emoji: "🔧" },
  { id: "electrician",     label: "Electrician",     emoji: "⚡" },
  { id: "welder",          label: "Welder",          emoji: "🔨" },
  { id: "fabricator",      label: "Sheet-Metal / Fabricator", emoji: "🏭" },
  { id: "machinist",       label: "Machinist / CNC", emoji: "⚙️" },
  { id: "manufacturing",   label: "Manufacturing GM", emoji: "🏗️" },
  { id: "rn",              label: "Registered Nurse", emoji: "🩺" },
  { id: "lpn",             label: "LPN", emoji: "💊" },
  { id: "cna",             label: "CNA / Aide", emoji: "❤️" },
  { id: "cdl_driver",      label: "CDL Driver", emoji: "🚛" },
];

const URGENCY_OPTIONS = [
  { id: "asap",   label: "Need someone in 7 days",   priority: 10 },
  { id: "30day",  label: "Hiring in next 30 days",   priority: 7 },
  { id: "60day",  label: "Building a pipeline (60d+)", priority: 4 },
];

const STEP_LABELS = ["Trades", "Service Area", "Urgency", "Notifications", "Launch"];

export default function TalentRadarSetup() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get("token");

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [client, setClient] = useState<any>(null);

  // Wizard state
  const [trades, setTrades] = useState<string[]>([]);
  const [zips, setZips] = useState("");
  const [counties, setCounties] = useState<string[]>([]);
  const [urgency, setUrgency] = useState("30day");
  const [headcount, setHeadcount] = useState("2");
  const [notifyEmail, setNotifyEmail] = useState(true);
  const [notifySms, setNotifySms] = useState(true);
  const [phone, setPhone] = useState("");
  const [digestTime, setDigestTime] = useState("08:00");

  useEffect(() => {
    if (!token) { setLoading(false); return; }
    (async () => {
      const { data, error } = await supabase
        .from("hire_alert_clients")
        .select("*")
        .eq("dashboard_token", token)
        .maybeSingle();
      if (error || !data) { setLoading(false); return; }
      setClient(data);
      setTrades(data.target_roles || []);
      setZips((data.target_zip_codes || []).join(", "));
      setCounties(data.territory_counties || []);
      setNotifyEmail(data.notify_email ?? true);
      setNotifySms(data.notify_sms ?? true);
      setPhone(data.owner_phone || "");
      setLoading(false);
    })();
  }, [token]);

  const toggleTrade = (id: string) =>
    setTrades(prev => prev.includes(id) ? prev.filter(t => t !== id) : [...prev, id]);

  const toggleCounty = (c: string) =>
    setCounties(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);

  const canAdvance = () => {
    if (step === 1) return trades.length > 0;
    if (step === 2) return zips.trim().length > 0 || counties.length > 0;
    if (step === 3) return !!urgency;
    if (step === 4) return notifyEmail || notifySms;
    return true;
  };

  const saveAndNext = async () => {
    if (!canAdvance()) return;
    if (step < 5) { setStep(s => s + 1); return; }
  };

  const launch = async () => {
    if (!client) { toastError("Missing client context"); return; }
    setSaving(true);
    const zipList = zips.split(/[,\s]+/).map(z => z.trim()).filter(z => /^\d{5}$/.test(z));
    const { error } = await supabase
      .from("hire_alert_clients")
      .update({
        target_roles: trades,
        target_zip_codes: zipList,
        territory_counties: counties.length > 0 ? counties : ["all_michigan"],
        notify_email: notifyEmail,
        notify_sms: notifySms,
        owner_phone: phone || client.owner_phone,
      })
      .eq("id", client.id);
    if (error) { toastError(error.message); setSaving(false); return; }
    setSaving(false);
    setScanning(true);
    try {
      // Fire scanner immediately — don't wait for full completion
      void supabase.functions.invoke("techalert-prospect-hunter", {
        body: { client_id: client.id, urgency, headcount: parseInt(headcount, 10) || 2 },
      });
      await new Promise(r => setTimeout(r, 1200));
      toastSuccess("Setup complete — scanners running now");
      navigate(`/talent-radar/dashboard?token=${token}`);
    } catch (e: any) {
      toastError(e.message || "Scan trigger failed — your setup is saved");
      navigate(`/talent-radar/dashboard?token=${token}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#030711] flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#00d4ff]" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-[#030711] flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-white font-bold text-lg mb-2">Setup link not recognized</h2>
          <p className="text-white/50 text-sm mb-4">This link is invalid or expired.</p>
          <a href="/talent-radar" className="text-[#00d4ff] text-sm hover:underline">Get TechAlert →</a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#030711] text-white">
      <SEOHead
        title="TechAlert Setup — Detroit Web Agency"
        description="Configure your TechAlert in under 60 seconds. Pick trades, ZIPs, urgency, notifications. First scan fires on submit."
      />

      {/* Progress bar */}
      <div className="border-b border-[#1e3a5f] bg-[#0a1628]/80 sticky top-0 z-20 backdrop-blur">
        <div className="max-w-3xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-2">
            <h1 className="text-sm font-bold text-[#00d4ff] uppercase tracking-widest">TechAlert Setup</h1>
            <span className="text-xs text-white/50">Step {step} of 5</span>
          </div>
          <div className="flex gap-1">
            {STEP_LABELS.map((label, i) => {
              const n = i + 1;
              const isActive = n === step;
              const isDone = n < step;
              return (
                <div
                  key={label}
                  className={`flex-1 h-1.5 rounded-full transition-colors ${
                    isDone ? "bg-[#00d4ff]" : isActive ? "bg-[#00d4ff]/50" : "bg-white/10"
                  }`}
                  title={label}
                />
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-8 pb-32">

        {/* STEP 1 — Trades */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00d4ff]/20 flex items-center justify-center shrink-0">
                <Briefcase className="h-5 w-5 text-[#00d4ff]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">What roles are you hiring?</h2>
                <p className="text-white/50 text-sm">Pick all that apply. We'll scan license boards and hiring signals for these every 6 hours.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {TRADE_OPTIONS.map(t => {
                const active = trades.includes(t.id);
                return (
                  <button
                    key={t.id}
                    onClick={() => toggleTrade(t.id)}
                    className={`p-3 rounded-xl border-2 text-left transition-all ${
                      active
                        ? "border-[#00d4ff] bg-[#00d4ff]/10"
                        : "border-white/10 bg-[#0a1628] hover:border-white/30"
                    }`}
                  >
                    <div className="text-xl mb-1">{t.emoji}</div>
                    <div className="text-sm font-semibold">{t.label}</div>
                    {active && <CheckCircle2 className="h-4 w-4 text-[#00d4ff] mt-1" />}
                  </button>
                );
              })}
            </div>

            {trades.length > 0 && (
              <div className="text-xs text-[#00d4ff]/70">
                ✓ {trades.length} trade{trades.length !== 1 ? "s" : ""} selected
              </div>
            )}
          </div>
        )}

        {/* STEP 2 — Service Area */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00d4ff]/20 flex items-center justify-center shrink-0">
                <MapPin className="h-5 w-5 text-[#00d4ff]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">Where do you hire?</h2>
                <p className="text-white/50 text-sm">Enter ZIP codes or pick counties. Add as many as you like.</p>
              </div>
            </div>

            <div>
              <label className="text-xs uppercase font-bold text-white/60 mb-2 block">ZIP codes</label>
              <Input
                value={zips}
                onChange={e => setZips(e.target.value)}
                placeholder="48201, 48226, 48207, 48208…"
                className="bg-[#0a1628] border-white/10 text-white"
              />
              <p className="text-[11px] text-white/40 mt-1">Separate with commas or spaces. We'll detect 5-digit ZIPs automatically.</p>
            </div>

            <div>
              <label className="text-xs uppercase font-bold text-white/60 mb-2 block">Or pick counties</label>
              <div className="flex flex-wrap gap-1.5">
                {["Wayne", "Oakland", "Macomb", "Washtenaw", "Genesee", "St. Clair", "Lapeer", "Livingston", "Monroe"].map(c => {
                  const active = counties.includes(c);
                  return (
                    <button
                      key={c}
                      onClick={() => toggleCounty(c)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                        active
                          ? "bg-[#00d4ff]/20 border-[#00d4ff] text-[#00d4ff]"
                          : "bg-[#0a1628] border-white/10 text-white/60 hover:border-white/30"
                      }`}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* STEP 3 — Urgency */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00d4ff]/20 flex items-center justify-center shrink-0">
                <Zap className="h-5 w-5 text-[#00d4ff]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">How urgent is this hire?</h2>
                <p className="text-white/50 text-sm">We'll prioritize scan frequency and alert thresholds based on your timeline.</p>
              </div>
            </div>

            <div className="space-y-2">
              {URGENCY_OPTIONS.map(u => {
                const active = urgency === u.id;
                return (
                  <button
                    key={u.id}
                    onClick={() => setUrgency(u.id)}
                    className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-center justify-between ${
                      active
                        ? "border-[#00d4ff] bg-[#00d4ff]/10"
                        : "border-white/10 bg-[#0a1628] hover:border-white/30"
                    }`}
                  >
                    <div>
                      <div className="text-sm font-semibold">{u.label}</div>
                      <div className="text-[11px] text-white/40">Priority weight: {u.priority}/10</div>
                    </div>
                    {active && <CheckCircle2 className="h-5 w-5 text-[#00d4ff]" />}
                  </button>
                );
              })}
            </div>

            <div>
              <label className="text-xs uppercase font-bold text-white/60 mb-2 block">How many people do you need?</label>
              <Input
                type="number"
                min="1"
                max="100"
                value={headcount}
                onChange={e => setHeadcount(e.target.value)}
                className="bg-[#0a1628] border-white/10 text-white max-w-[120px]"
              />
            </div>
          </div>
        )}

        {/* STEP 4 — Notifications */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00d4ff]/20 flex items-center justify-center shrink-0">
                <Bell className="h-5 w-5 text-[#00d4ff]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">Where should alerts go?</h2>
                <p className="text-white/50 text-sm">High-score candidates trigger instant alerts. Daily digest summarizes everything new.</p>
              </div>
            </div>

            <div className="space-y-3">
              <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                notifyEmail ? "border-[#00d4ff] bg-[#00d4ff]/10" : "border-white/10 bg-[#0a1628]"
              }`}>
                <input type="checkbox" checked={notifyEmail} onChange={e => setNotifyEmail(e.target.checked)} className="w-5 h-5 accent-[#00d4ff]" />
                <div className="flex-1">
                  <div className="text-sm font-semibold">Email digest at {digestTime} ET</div>
                  <div className="text-[11px] text-white/40">Sent to {client.owner_email}</div>
                </div>
              </label>

              <label className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                notifySms ? "border-[#00d4ff] bg-[#00d4ff]/10" : "border-white/10 bg-[#0a1628]"
              }`}>
                <input type="checkbox" checked={notifySms} onChange={e => setNotifySms(e.target.checked)} className="w-5 h-5 accent-[#00d4ff]" />
                <div className="flex-1">
                  <div className="text-sm font-semibold">SMS for high-score candidates (≥9/10)</div>
                  <div className="text-[11px] text-white/40">Quiet hours respected (8am–9pm local)</div>
                </div>
              </label>

              {notifySms && (
                <div className="ml-8">
                  <label className="text-xs uppercase font-bold text-white/60 mb-1 block">SMS phone</label>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={e => setPhone(e.target.value)}
                    placeholder="(313) 555-0100"
                    className="bg-[#0a1628] border-white/10 text-white max-w-xs"
                  />
                </div>
              )}

              <div>
                <label className="text-xs uppercase font-bold text-white/60 mb-1 block">Digest delivery time</label>
                <Input
                  type="time"
                  value={digestTime}
                  onChange={e => setDigestTime(e.target.value)}
                  className="bg-[#0a1628] border-white/10 text-white max-w-[140px]"
                />
              </div>
            </div>
          </div>
        )}

        {/* STEP 5 — Review & Launch */}
        {step === 5 && (
          <div className="space-y-6">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-[#00d4ff]/20 flex items-center justify-center shrink-0">
                <Sparkles className="h-5 w-5 text-[#00d4ff]" />
              </div>
              <div>
                <h2 className="text-2xl font-bold mb-1">Review &amp; Launch</h2>
                <p className="text-white/50 text-sm">Hitting Launch fires the first scan immediately. First candidates within 2 hours.</p>
              </div>
            </div>

            <div className="rounded-xl border border-white/10 bg-[#0a1628] p-5 space-y-4">
              <div>
                <div className="text-[10px] uppercase text-white/40 font-bold mb-1">Trades</div>
                <div className="flex flex-wrap gap-1.5">
                  {trades.map(t => (
                    <Badge key={t} className="bg-[#00d4ff]/15 text-[#00d4ff] border-[#00d4ff]/30">
                      {TRADE_OPTIONS.find(o => o.id === t)?.label || t}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-white/40 font-bold mb-1">Service area</div>
                <div className="text-sm text-white/80">
                  {zips.split(/[,\s]+/).filter(z => /^\d{5}$/.test(z.trim())).length} ZIP{zips ? "s" : ""}
                  {counties.length > 0 ? ` · ${counties.join(", ")}` : ""}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-white/40 font-bold mb-1">Hiring urgency</div>
                <div className="text-sm text-white/80">
                  {URGENCY_OPTIONS.find(u => u.id === urgency)?.label} · {headcount} person{headcount !== "1" ? "s" : ""}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase text-white/40 font-bold mb-1">Notifications</div>
                <div className="text-sm text-white/80">
                  {notifyEmail && `Email at ${digestTime} ET`}{notifyEmail && notifySms && " · "}
                  {notifySms && `SMS for high-score`}
                </div>
              </div>
            </div>

            <Button
              onClick={launch}
              disabled={saving || scanning}
              className="w-full h-14 bg-[#00d4ff] hover:bg-[#00d4ff]/90 text-[#0a1628] font-bold text-base"
            >
              {saving || scanning ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Launching scanners…</>
              ) : (
                <><Zap className="h-4 w-4 mr-2" /> Launch TechAlert</>
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Sticky bottom nav */}
      {step < 5 && (
        <div className="fixed bottom-0 inset-x-0 border-t border-[#1e3a5f] bg-[#0a1628]/95 backdrop-blur z-20">
          <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              disabled={step === 1}
              onClick={() => setStep(s => Math.max(1, s - 1))}
              className="border-white/10 text-white"
            >
              <ChevronLeft className="h-4 w-4 mr-1" /> Back
            </Button>
            <Button
              disabled={!canAdvance()}
              onClick={saveAndNext}
              className="bg-[#00d4ff] hover:bg-[#00d4ff]/90 text-[#0a1628] font-bold flex-1 max-w-xs"
            >
              Continue <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

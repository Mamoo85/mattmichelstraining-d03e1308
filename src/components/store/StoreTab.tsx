import { useState, useRef } from "react";
import InteractivePrograms from "./InteractivePrograms";
import MerchSection from "../MerchSection";
import GiftCardSection from "./GiftCardSection";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, TIER_DISCOUNTS } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, ShoppingBag, Upload, Video, Check,
  Dumbbell, Calendar, Gift
} from "lucide-react";

const SUB_TABS = [
  { key: "sessions", label: "Sessions" },
  { key: "programs", label: "Interactive Programs" },
  { key: "custom", label: "Custom Program" },
  { key: "giftcards", label: "Gift Cards" },
  { key: "merchandise", label: "Merchandise" },
];

const CUSTOM_TIERS = [
  {
    weeks: 1,
    price: 20,
    priceId: "price_1TBr6BD52tPWee46wdDiLIyw",
    label: "1 Week",
    description: "Quick-start or trial week",
    best: false,
  },
  {
    weeks: 2,
    price: 30,
    priceId: "price_1TBr6TD52tPWee4679jEqOU6",
    label: "2 Weeks",
    description: "Short cycle — testing or in-season",
    best: false,
  },
  {
    weeks: 3,
    price: 30,
    priceId: "price_1TBr6oD52tPWee46giFyG26m",
    label: "3 Weeks",
    description: "Solid training block",
    best: false,
  },
  {
    weeks: 4,
    price: 40,
    priceId: "price_1TBr74D52tPWee4615Sw3IPI",
    label: "4 Weeks",
    description: "Full cycle — best value per week",
    best: true,
  },
];

const SessionsRedirect = () => {
  const navigate = (await import("react-router-dom")).useNavigate;
  return null;
};

const SessionsTab = () => {
  return (
    <div className="bg-card shadow-m2 p-6 text-center space-y-4">
      <Calendar size={32} className="mx-auto text-primary" />
      <h2 className="text-base font-bold text-foreground">Book a Training Session</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Train with Matt in person. 30-minute sessions are <strong className="text-foreground">$50</strong> and 
        1-hour sessions are <strong className="text-foreground">$90</strong>. View available times and book instantly.
      </p>
      <a
        href="/schedule"
        className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
      >
        <Calendar size={14} />
        View Schedule & Book
      </a>
    </div>
  );
};

const StoreTab = () => {
  const [subTab, setSubTab] = useState("sessions");

  return (
    <div>
      <div className="flex gap-1 mb-6 flex-wrap">
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest transition-m2 ${
              subTab === t.key
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {subTab === "sessions" && <SessionsTab />}
      {subTab === "programs" && <InteractivePrograms />}
      {subTab === "custom" && <CustomProgramSection />}
      {subTab === "giftcards" && <GiftCardSection />}
      {subTab === "merchandise" && <MerchSection />}
    </div>
  );
};

const CustomProgramSection = () => {
  const { user, subscriptionTier } = useAuth();
  const discountPct = subscriptionTier ? (TIER_DISCOUNTS[subscriptionTier] || 0) : 0;
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedTier, setSelectedTier] = useState(3);
  const [parentName, setParentName] = useState("");
  const [email, setEmail] = useState("");
  const [athleteName, setAthleteName] = useState("");
  const [ageSport, setAgeSport] = useState("");
  const [goals, setGoals] = useState("");
  const [equipment, setEquipment] = useState("");
  const [injuries, setInjuries] = useState("");
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);

  const tier = CUSTOM_TIERS[selectedTier];

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 25MB. Try trimming or compressing.", variant: "destructive" });
      return;
    }

    setVideoFile(file);

    if (!user) {
      toast({ title: "Sign in first", description: "You need to sign in to upload a video.", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "mp4";
      const path = `postural/${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("form-check-videos").upload(path, file);
      if (error) throw error;

      const { data: urlData } = supabase.storage.from("form-check-videos").getPublicUrl(path);
      setVideoUrl(urlData.publicUrl);
      toast({ title: "Video uploaded!", description: "Matt will review it when building your program." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
      setVideoFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleBuy = async () => {
    if (!parentName.trim() || !email.trim() || !athleteName.trim() || !ageSport.trim() || !goals.trim()) {
      toast({ title: "Fill out the required fields", description: "Matt needs this info to build your program.", variant: "destructive" });
      return;
    }

    if (!user) {
      window.location.href = `/auth?redirect=/shop`;
      return;
    }

    setBuying(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-guide-payment", {
        body: {
          priceId: tier.priceId,
          metadata: {
            type: "custom_program",
            weeks: tier.weeks,
            parent_name: parentName,
            athlete_name: athleteName,
            age_sport: ageSport,
            goals: goals.substring(0, 500),
            equipment: equipment.substring(0, 500),
            injuries: injuries.substring(0, 500),
            postural_video: videoUrl || "none",
          },
        },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Checkout error", description: err.message, variant: "destructive" });
    } finally {
      setBuying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero pitch */}
      <div className="bg-primary/10 border border-primary/20 p-5">
        <h2 className="text-base font-bold text-foreground mb-2">Your Program. Built by Matt. From Scratch.</h2>
        <p className="text-sm text-muted-foreground leading-relaxed">
          No templates. No AI. Matt reads your intake, watches your video (if you send one), and builds a
          100% custom program for your goals, your equipment, and your level. 20 years of doing this — condensed
          into a plan made just for you.
        </p>
      </div>

      {/* Tier selector */}
      <div>
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
          <Calendar size={12} /> Choose Your Program Length
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CUSTOM_TIERS.map((t, i) => (
            <button
              key={t.weeks}
              onClick={() => setSelectedTier(i)}
              className={`relative p-4 border-2 transition-m2 text-left ${
                selectedTier === i
                  ? "border-primary bg-primary/10"
                  : "border-border bg-card hover:border-primary/40"
              }`}
            >
              {t.best && (
                <span className="absolute -top-2 right-2 bg-primary text-primary-foreground text-[8px] font-bold uppercase tracking-widest px-2 py-0.5">
                  Best Value
                </span>
              )}
              {discountPct > 0 && <div className="text-[9px] text-muted-foreground line-through">${t.price}</div>}
              <div className="text-xl font-mono font-bold text-primary">${discountPct > 0 ? (t.price * (1 - discountPct / 100)).toFixed(2) : t.price}</div>
              <div className="text-sm font-bold text-foreground mt-1">{t.label}</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{t.description}</div>
              {t.weeks > 1 && (
                <div className="text-[9px] text-primary font-mono mt-1">
                  ${(t.price / t.weeks).toFixed(0)}/week
                </div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* What's included */}
      <div className="bg-card shadow-m2 p-4">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3 flex items-center gap-1.5">
          <Dumbbell size={12} /> What You Get
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {[
            "100% custom — written for YOUR athlete",
            "Coaching cues on every movement",
            "The WHY behind every exercise choice",
            `Full ${tier.label.toLowerCase()} of programming`,
            "Warmup & cooldown included",
            "Equipment-specific — gym, home, or travel",
            "Matt's guarantee: fix it or refund",
            "Postural video review (if submitted)",
          ].map((item, i) => (
            <div key={i} className="flex items-start gap-2 text-[11px] text-foreground">
              <Check size={12} className="text-primary flex-shrink-0 mt-0.5" />
              {item}
            </div>
          ))}
        </div>
      </div>

      {/* Intake form */}
      <div className="bg-card shadow-m2 p-5">
        <h3 className="text-sm font-bold text-foreground mb-1">Tell Matt About Your Athlete</h3>
        <p className="text-[10px] text-muted-foreground mb-4">
          Matt reads every word. The more you share, the better the program.
        </p>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Your Name *</label>
              <input value={parentName} onChange={e => setParentName(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                placeholder="Parent or athlete name" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email *</label>
              <input value={email} onChange={e => setEmail(e.target.value)} type="email"
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                placeholder="you@email.com" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Athlete's Name *</label>
              <input value={athleteName} onChange={e => setAthleteName(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                placeholder="Who is this for?" />
            </div>
            <div>
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Age & Sport(s) *</label>
              <input value={ageSport} onChange={e => setAgeSport(e.target.value)}
                className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
                placeholder="e.g. 15, Baseball & Basketball" />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Goals *</label>
            <textarea value={goals} onChange={e => setGoals(e.target.value)}
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none h-20 resize-none"
              placeholder="What's the goal? More power? Better durability? Getting ready for a specific season?" />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Available Equipment</label>
            <input value={equipment} onChange={e => setEquipment(e.target.value)}
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
              placeholder="Full gym? Home setup? Just bands? Tell Matt what you have." />
          </div>

          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Injuries or Limitations</label>
            <textarea value={injuries} onChange={e => setInjuries(e.target.value)}
              className="w-full bg-background border border-border px-3 py-2 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none h-16 resize-none"
              placeholder="Anything Matt should know — previous injuries, pain areas, movement limitations." />
          </div>
        </div>
      </div>

      {/* Postural video upload */}
      <div className="bg-card shadow-m2 p-5 border border-primary/20">
        <div className="flex items-start gap-3">
          <Video size={20} className="text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground mb-1">
              Postural Assessment Video
              <span className="text-[9px] font-normal text-muted-foreground ml-2 uppercase tracking-widest">Optional but encouraged</span>
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              This helps Matt see how your athlete moves before writing a single exercise. Record <strong className="text-foreground">5 slow overhead squats</strong> holding
              a broomstick, PVC pipe, or anything light. Film from the <strong className="text-foreground">front</strong> and <strong className="text-foreground">side</strong>. Go slow — Matt's watching
              for balance, mobility, and compensations. This is how he builds programs that actually fix things.
            </p>

            <div className="bg-muted p-3 mb-3 space-y-1.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-foreground">How to record:</p>
              <div className="text-[11px] text-muted-foreground space-y-1">
                <p>1. Grab a broomstick, bat, or PVC pipe</p>
                <p>2. Hold it overhead with arms straight</p>
                <p>3. Do 5 slow squats — as deep as comfortable</p>
                <p>4. Film from the <strong className="text-foreground">front</strong>, then turn 90° and film from the <strong className="text-foreground">side</strong></p>
                <p>5. Don't worry about being perfect — that's the point</p>
              </div>
            </div>

            {videoUrl ? (
              <div className="flex items-center gap-2 text-xs text-primary font-bold">
                <Check size={14} /> Video uploaded — Matt will review it
              </div>
            ) : (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="video/*"
                  capture="environment"
                  onChange={handleVideoSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !user}
                  className="bg-primary/10 border border-primary/30 text-primary px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-m2 flex items-center gap-2 disabled:opacity-50"
                >
                  {uploading ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <Upload size={12} />
                  )}
                  {uploading ? "Uploading…" : user ? "Upload Video (max 25MB)" : "Sign in to upload"}
                </button>
                {videoFile && !videoUrl && !uploading && (
                  <p className="text-[10px] text-muted-foreground mt-1">{videoFile.name}</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Purchase button */}
      <div className="bg-card shadow-m2 p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-foreground">Ready to order?</h3>
            <p className="text-[10px] text-muted-foreground">
              Secure checkout via Stripe. Matt builds your program personally after payment.
            </p>
          </div>
          <div className="text-right">
            {discountPct > 0 && <div className="text-sm text-muted-foreground line-through">${tier.price}</div>}
            <div className="text-2xl font-mono font-bold text-primary">
              ${discountPct > 0 ? (tier.price * (1 - discountPct / 100)).toFixed(2) : tier.price}
            </div>
            <div className="text-[9px] text-muted-foreground">{tier.label} custom program</div>
            {discountPct > 0 && (
              <div className="text-[8px] text-primary font-bold uppercase tracking-widest">{discountPct}% member discount</div>
            )}
          </div>
        </div>

        <button
          onClick={handleBuy}
          disabled={buying}
          className="bg-primary text-primary-foreground px-6 py-3 text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-2 w-full justify-center disabled:opacity-50"
        >
          {buying ? <Loader2 size={14} className="animate-spin" /> : <ShoppingBag size={14} />}
          Get Your Custom {tier.label} Program · ${discountPct > 0 ? (tier.price * (1 - discountPct / 100)).toFixed(2) : tier.price}
        </button>
      </div>

      {/* Why custom costs more */}
      <div className="bg-muted p-4 text-center">
        <p className="text-xs text-foreground font-bold mb-1">Why does custom cost more than pre-built?</p>
        <p className="text-[11px] text-muted-foreground leading-relaxed max-w-md mx-auto">
          Pre-built programs are templates Matt created once for a broad audience. Custom programs are written from scratch
          after Matt personally reviews your intake and video. It's 1-on-1 attention at a fraction of the in-person rate
          ($100+/hour).
        </p>
      </div>
    </div>
  );
};

export default StoreTab;

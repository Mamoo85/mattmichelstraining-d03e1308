import { useState, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, TIER_DISCOUNTS } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Loader2, ShoppingBag, Shield, AlertTriangle, Check,
  Upload, Video, Heart, Clock, Zap, BookOpen
} from "lucide-react";

const FOUNDATION_PROGRAMS = [
  {
    age: "11–13",
    title: "Youth Foundation — Ages 11-13",
    subtitle: "Movement Quality & Body Awareness",
    priceId: "price_1TC0lMD52tPWee467OQMos3U",
    price: 20,
    color: "from-green-500/20 to-green-600/10",
    icon: BookOpen,
    includes: [
      "Age-appropriate strength training",
      "Movement quality & coordination",
      "Core stability fundamentals",
      "Mobility & flexibility work",
      "No heavy loading — ever",
      "FREE postural assessment via video",
    ],
    desc: "The operating system their body will run on for the next decade. Proper form, connective tissue strength, and habits that prevent injury later.",
  },
  {
    age: "14–15",
    title: "Youth Foundation — Ages 14-15",
    subtitle: "Work Capacity & Durability",
    priceId: "price_1TC0lfD52tPWee46YyugP7R9",
    price: 20,
    color: "from-blue-500/20 to-blue-600/10",
    icon: Heart,
    includes: [
      "Structured resistance training",
      "Joint & tendon strengthening",
      "Connective tissue development",
      "Injury-proof programming",
      "Work capacity building",
      "FREE postural assessment via video",
    ],
    desc: "The phase most programs skip — and where injuries start. Focused on joints, tendons, and connective tissue BEFORE adding load.",
  },
  {
    age: "16–17",
    title: "Youth Foundation — Ages 16-17",
    subtitle: "Strength & Power Development",
    priceId: "price_1TC0m9D52tPWee46DevWrrCZ",
    price: 20,
    color: "from-orange-500/20 to-orange-600/10",
    icon: Zap,
    includes: [
      "Progressive overload training",
      "Sport-specific strength work",
      "Competition prep programming",
      "Power development",
      "Advanced mobility protocols",
      "FREE postural assessment via video",
    ],
    desc: "Now they're ready. Their body can handle real load because you didn't rush the first two phases.",
  },
  {
    age: "18+",
    title: "Youth Foundation — Ages 18+",
    subtitle: "College Prep & Peak Durability",
    priceId: "price_1TC0mYD52tPWee46rPtVnjTj",
    price: 20,
    color: "from-primary/20 to-primary/10",
    icon: Clock,
    includes: [
      "Peak performance programming",
      "Durability under volume",
      "College-ready conditioning",
      "Advanced strength protocols",
      "Recovery & maintenance systems",
      "FREE postural assessment via video",
    ],
    desc: "College coaches don't care how strong you were in high school if you're injured by October. This builds durability.",
  },
];

const FoundationPrograms = () => {
  const { user, subscriptionTier } = useAuth();
  const discountPct = subscriptionTier ? (TIER_DISCOUNTS[subscriptionTier] || 0) : 0;
  const { toast } = useToast();
  const [buying, setBuying] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (file.size > 25 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 25MB", variant: "destructive" });
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
      toast({ title: "Video uploaded!", description: "Matt will review it with your program." });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleBuy = async (program: typeof FOUNDATION_PROGRAMS[0]) => {
    if (!user) {
      window.location.href = `/auth?redirect=/shop`;
      return;
    }
    setBuying(program.priceId);
    try {
      const { data, error } = await supabase.functions.invoke("create-checkout", {
        body: {
          priceId: program.priceId,
        },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (err: any) {
      toast({ title: "Checkout error", description: err.message, variant: "destructive" });
    } finally {
      setBuying(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="bg-destructive/10 border-2 border-destructive/30 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle size={22} className="text-destructive flex-shrink-0 mt-0.5" />
          <div>
            <h2 className="text-base font-bold text-foreground mb-1">
              Parents: Your Child's Body Is Not a Science Experiment
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              3.5 million youth sports injuries per year — <strong className="text-foreground">50% are preventable</strong> with
              proper strength training. These foundation programs teach your child how to move correctly, build real strength,
              and take care of their body for the rest of their life. Each package includes a <strong className="text-primary">FREE
              postural assessment</strong> by Matt.
            </p>
          </div>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-card shadow-m2 p-5">
        <h3 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">
          How It Works for Parents
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <span className="text-primary font-mono font-bold">1</span>
            <p><strong className="text-foreground">Buy the program</strong> — it's loaded into the portal instantly. Your child can access it on their phone, or you can print it out.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary font-mono font-bold">2</span>
            <p><strong className="text-foreground">Create a child account</strong> — link it to yours so you can monitor progress alongside Matt.</p>
          </div>
          <div className="flex items-start gap-2">
            <span className="text-primary font-mono font-bold">3</span>
            <p><strong className="text-foreground">FREE postural assessment</strong> — Matt reviews your child's movement via video and personalizes guidance.</p>
          </div>
        </div>
      </div>

      {/* Postural video upload */}
      <div className="bg-card shadow-m2 p-5 border border-primary/20">
        <div className="flex items-start gap-3">
          <Video size={20} className="text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground mb-1">
              FREE Postural Assessment
              <span className="text-[9px] font-normal text-primary ml-2 uppercase tracking-widest">Included with every program</span>
            </h3>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              Record <strong className="text-foreground">5 slow overhead squats</strong> (front and side view) and upload here or
              schedule a live video chat with Matt. He'll review your child's movement patterns and provide personalized guidance.
            </p>
            {videoUrl ? (
              <div className="flex items-center gap-2 text-xs text-primary font-bold">
                <Check size={14} /> Video uploaded — Matt will review it
              </div>
            ) : (
              <div className="flex gap-2">
                <input ref={fileInputRef} type="file" accept="video/*" capture="environment" onChange={handleVideoUpload} className="hidden" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading || !user}
                  className="bg-primary/10 border border-primary/30 text-primary px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/20 transition-m2 flex items-center gap-2 disabled:opacity-50"
                >
                  {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
                  {uploading ? "Uploading…" : user ? "Upload Assessment Video" : "Sign in to upload"}
                </button>
                <a
                  href="/schedule"
                  className="bg-muted text-muted-foreground hover:text-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-m2"
                >
                  Schedule Video Chat
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Program cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {FOUNDATION_PROGRAMS.map((p) => {
          const Icon = p.icon;
          const finalPrice = discountPct > 0 ? p.price * (1 - discountPct / 100) : p.price;
          return (
            <div key={p.priceId} className="bg-card shadow-m2 overflow-hidden flex flex-col">
              <div className={`bg-gradient-to-r ${p.color} p-4 border-b border-border`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon size={18} className="text-primary" />
                    <span className="text-lg font-mono font-bold text-primary">{p.age}</span>
                  </div>
                  <div className="text-right">
                    {discountPct > 0 && <div className="text-[10px] text-muted-foreground line-through">${p.price}</div>}
                    <div className="text-xl font-mono font-bold text-primary">${finalPrice.toFixed(0)}</div>
                  </div>
                </div>
                <h3 className="text-sm font-bold text-foreground mt-1">{p.subtitle}</h3>
              </div>
              <div className="p-4 flex-1 flex flex-col">
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">{p.desc}</p>
                <div className="space-y-1.5 mb-4 flex-1">
                  {p.includes.map((item) => (
                    <div key={item} className="flex items-start gap-2 text-[11px] text-foreground">
                      <Check size={11} className="text-primary flex-shrink-0 mt-0.5" />
                      {item}
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => handleBuy(p)}
                  disabled={buying === p.priceId}
                  className="bg-primary text-primary-foreground px-4 py-3 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center justify-center gap-2 w-full disabled:opacity-50"
                >
                  {buying === p.priceId ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <ShoppingBag size={14} />
                  )}
                  Get Program · ${finalPrice.toFixed(0)}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Safety record */}
      <div className="bg-primary/10 border-2 border-primary/30 p-5">
        <div className="flex items-start gap-3">
          <Shield size={20} className="text-primary flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm text-foreground font-bold mb-1">Matt's record: Zero injuries. Twenty years.</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every program includes mobility, core stability, strength, balance, coordination, and targeted recovery.
              Your child learns how to take care of their body for the rest of their life — not just this season.
            </p>
          </div>
        </div>
      </div>

      {/* In-person option */}
      <div className="bg-card shadow-m2 p-5 text-center">
        <h3 className="text-sm font-bold text-foreground mb-2">Prefer In-Person Training?</h3>
        <p className="text-xs text-muted-foreground mb-4 max-w-md mx-auto">
          Matt trains youth athletes in Grosse Pointe Park, MI. 1-on-1, small group, or team programs available.
        </p>
        <div className="flex flex-wrap gap-3 justify-center">
          <a
            href="/schedule"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2"
          >
            Book a Session
          </a>
          <a
            href="mailto:matthewmichels4@gmail.com?subject=Youth%20Training%20Inquiry"
            className="inline-flex items-center gap-2 border-2 border-primary/40 text-primary px-5 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:bg-primary/10 transition-m2"
          >
            Email Matt
          </a>
        </div>
      </div>
    </div>
  );
};

export default FoundationPrograms;

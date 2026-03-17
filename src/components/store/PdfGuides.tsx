import { useState } from "react";
import { FileText, Loader2, ShoppingBag, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface Guide {
  id: string;
  title: string;
  subtitle: string;
  price: string;
  priceId: string;
  description: string;
  includes: string[];
}

const GUIDES: Guide[] = [
  {
    id: "middle-school-foundation",
    title: "The Middle School Foundation (Top 10)",
    subtitle: "Build the base before the game gets serious",
    price: "$15",
    priceId: "price_middle_school_foundation",
    description: "The 10 exercises every middle schooler needs before they step into competitive sports. Movement quality, injury-proofing, and the foundation that lasts a lifetime.",
    includes: ["10 exercises with full breakdowns", "Age-appropriate progressions", "The WHY behind each movement", "Parent guide included"],
  },
  {
    id: "high-school-armor",
    title: "High School Armor (Top 10)",
    subtitle: "Bulletproof your body for varsity",
    price: "$15",
    priceId: "price_high_school_armor",
    description: "High school is where injuries happen — because kids skip the armor. These 10 exercises build durability, explosive power, and the structural integrity coaches can't teach.",
    includes: ["10 exercises with sets & reps", "In-season vs off-season guidance", "The WHY behind each movement", "Injury prevention protocols"],
  },
  {
    id: "road-warrior",
    title: "The Road Warrior (Top 10 Travel Fixes)",
    subtitle: "Stay sharp when you can't get to the gym",
    price: "$15",
    priceId: "price_road_warrior",
    description: "Hotel room. Airport layover. Tournament weekend. These 10 movements keep your body right when life takes you away from the gym. No equipment needed.",
    includes: ["10 no-equipment exercises", "Rolling & mobility sequences", "The WHY behind each movement", "Travel-day warmup protocol"],
  },
];

const PdfGuides = () => {
  const [expandedGuide, setExpandedGuide] = useState<string | null>(null);
  const [buyingId, setBuyingId] = useState<string | null>(null);
  const [guideRequest, setGuideRequest] = useState("");
  const [requestSending, setRequestSending] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  const handleBuy = async (guide: Guide) => {
    if (!user) {
      window.location.href = `/auth?redirect=/shop`;
      return;
    }
    setBuyingId(guide.id);
    try {
      const { data, error } = await supabase.functions.invoke("create-guide-payment", {
        body: { priceId: guide.priceId },
      });
      if (error) throw error;
      if (data?.url) window.open(data.url, "_blank");
    } catch (e: any) {
      toast({ title: "Payment error", description: e.message || "Something went wrong", variant: "destructive" });
    } finally {
      setBuyingId(null);
    }
  };

  const handleRequestGuide = async () => {
    if (!guideRequest.trim()) {
      toast({ title: "Enter a request", description: "Tell us what guide you're looking for.", variant: "destructive" });
      return;
    }
    setRequestSending(true);
    try {
      const { error } = await supabase.functions.invoke("request-guide", {
        body: {
          request: guideRequest.trim(),
          email: user?.email || "anonymous",
        },
      });
      if (error) throw error;
      toast({ title: "Request sent! 🙌", description: "Matt will review your request. Thanks for the input." });
      setGuideRequest("");
    } catch (e: any) {
      toast({ title: "Error sending request", description: e.message || "Something went wrong", variant: "destructive" });
    } finally {
      setRequestSending(false);
    }
  };

  return (
    <div>
      {/* Description */}
      <div className="bg-primary/10 border border-primary/20 p-4 mb-6">
        <p className="text-sm text-foreground leading-relaxed">
          Foundational top-10 blueprints at <strong>$15 each</strong>. These are static PDF guides designed to teach you the WHY behind specific movements and give you a standalone arsenal of exercises.
        </p>
      </div>

      {/* Guide grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {GUIDES.map((guide) => (
          <div
            key={guide.id}
            className="bg-card shadow-m2 p-4 flex flex-col hover:bg-accent/50 transition-m2 cursor-pointer"
            onClick={() => setExpandedGuide(expandedGuide === guide.id ? null : guide.id)}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary">PDF Guide</span>
              <span className="text-lg font-mono font-bold text-primary">{guide.price}</span>
            </div>
            <h3 className="text-sm font-bold text-foreground mb-1">{guide.title}</h3>
            <p className="text-[11px] text-muted-foreground mb-2">{guide.subtitle}</p>

            {expandedGuide === guide.id && (
              <div className="mt-2 pt-2 border-t border-border space-y-2">
                <p className="text-xs text-foreground leading-relaxed">{guide.description}</p>
                <div className="space-y-1">
                  {guide.includes.map((item, i) => (
                    <div key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground">
                      <span className="text-primary font-bold mt-0.5">✓</span>
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-auto pt-3">
              <button
                onClick={(e) => { e.stopPropagation(); handleBuy(guide); }}
                disabled={buyingId === guide.id}
                className="bg-primary text-primary-foreground px-4 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-1.5 w-full justify-center disabled:opacity-50"
              >
                {buyingId === guide.id ? (
                  <Loader2 size={12} className="animate-spin" />
                ) : (
                  <FileText size={12} />
                )}
                Buy Guide · {guide.price}
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Request a Guide section */}
      <div className="mt-8 bg-card shadow-m2 p-5">
        <h3 className="text-sm font-bold text-foreground mb-1">Don't see your sport?</h3>
        <p className="text-[11px] text-muted-foreground mb-4">
          Tell Matt what guide you need. He tracks every request and builds guides based on real demand.
        </p>
        <div className="flex gap-2">
          <input
            type="text"
            value={guideRequest}
            onChange={(e) => setGuideRequest(e.target.value)}
            placeholder="What guide do you need?"
            maxLength={200}
            className="flex-1 bg-background border border-border px-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:ring-1 focus:ring-primary outline-none"
          />
          <button
            onClick={handleRequestGuide}
            disabled={requestSending}
            className="bg-primary text-primary-foreground px-4 py-2.5 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-m2 flex items-center gap-1.5 disabled:opacity-50 flex-shrink-0"
          >
            {requestSending ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <Send size={12} />
            )}
            Request Guide
          </button>
        </div>
      </div>
    </div>
  );
};

export default PdfGuides;

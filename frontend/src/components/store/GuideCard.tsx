import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface Guide {
  id: string;
  title: string;
  sport?: string;
  price_cents: number;
  stripe_price_id?: string;
  is_active?: boolean;
}

interface GuideCardProps {
  guide: Guide;
  onBuy: (guide: Guide) => void;
  buying?: boolean;
}

const SPORT_COLORS: Record<string, string> = {
  football: "bg-amber-500/10 text-amber-400",
  baseball: "bg-blue-500/10 text-blue-400",
  basketball: "bg-orange-500/10 text-orange-400",
  soccer: "bg-green-500/10 text-green-400",
  hockey: "bg-cyan-500/10 text-cyan-400",
  lacrosse: "bg-purple-500/10 text-purple-400",
  wrestling: "bg-red-500/10 text-red-400",
  track: "bg-yellow-500/10 text-yellow-400",
  general: "bg-primary/10 text-primary",
};

const GuideCard = ({ guide, onBuy, buying = false }: GuideCardProps) => {
  const sportColor = SPORT_COLORS[guide.sport?.toLowerCase() || "general"] || SPORT_COLORS.general;
  const price = `$${(guide.price_cents / 100).toFixed(0)}`;

  return (
    <div className="bg-card border border-border flex flex-col hover:border-primary/40 transition-colors">
      <div className="p-5 flex-1">
        {guide.sport && (
          <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded mb-3 ${sportColor}`}>
            {guide.sport}
          </span>
        )}
        <h3 className="text-sm font-black text-foreground leading-tight mb-2">{guide.title}</h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Built from 20+ years coaching athletes. Exercises, programming, and coaching cues — delivered instantly to your inbox.
        </p>
      </div>
      <div className="px-5 pb-5 flex items-center justify-between">
        <span className="text-xl font-black text-primary">{price}</span>
        <Button
          size="sm"
          onClick={() => onBuy(guide)}
          disabled={buying}
          className="gap-1.5"
        >
          <ShoppingCart size={13} />
          Buy Now
        </Button>
      </div>
    </div>
  );
};

export default GuideCard;
export type { Guide };

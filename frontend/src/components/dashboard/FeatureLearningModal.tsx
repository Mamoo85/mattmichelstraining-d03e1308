import { X } from "lucide-react";

export interface FeatureTip {
  storageKey: string;
  image?: string;
  fallbackIcon?: React.ReactNode;
  fallbackGradient?: string;
  title: string;
  subtitle: string;
  bullets: { icon: React.ReactNode; text: string }[];
}

interface FeatureLearningModalProps {
  tip: FeatureTip;
  onContinue: () => void;
  onDismiss: () => void;
}

const FeatureLearningModal = ({ tip, onContinue, onDismiss }: FeatureLearningModalProps) => (
  <div className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4 animate-in fade-in">
    <div className="bg-card border border-border w-full max-w-md max-h-[90vh] flex flex-col shadow-2xl overflow-hidden rounded-2xl">
      {/* Close */}
      <div className="flex justify-end px-4 pt-3">
        <button
          onClick={onDismiss}
          className="p-1.5 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-5">
        {/* Image or gradient fallback */}
        {tip.image ? (
          <img
            src={tip.image}
            alt={tip.title}
            className="w-full rounded-xl border border-border object-cover"
            width={800}
            height={512}
            loading="lazy"
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        ) : tip.fallbackIcon ? (
          <div
            className="w-full h-40 rounded-xl flex items-center justify-center"
            style={{
              background: tip.fallbackGradient || "linear-gradient(135deg, rgba(249,115,22,0.15), rgba(168,85,247,0.1))",
              border: "1px solid rgba(255,255,255,0.08)",
            }}
          >
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center" style={{ background: "rgba(255,255,255,0.08)" }}>
              {tip.fallbackIcon}
            </div>
          </div>
        ) : null}

        {/* Heading */}
        <div className="text-center space-y-2">
          <h2 className="text-lg font-black uppercase tracking-widest text-foreground">
            {tip.title}
          </h2>
          <p className="text-sm text-muted-foreground leading-relaxed">
            {tip.subtitle}
          </p>
        </div>

        {/* Bullets */}
        <div className="space-y-3">
          {tip.bullets.map((b, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="shrink-0 w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center text-primary">
                {b.icon}
              </div>
              <p className="text-sm font-semibold text-foreground">{b.text}</p>
            </div>
          ))}
        </div>

        {/* Actions */}
        <div className="space-y-2 pt-2">
          <button
            onClick={onContinue}
            className="w-full h-12 bg-primary text-primary-foreground text-sm font-black uppercase tracking-widest hover:opacity-90 transition-all flex items-center justify-center rounded-xl"
          >
            Got It — Let's Go
          </button>
          <button
            onClick={onDismiss}
            className="w-full text-center text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 py-1"
          >
            Don't show this again
          </button>
        </div>
      </div>
    </div>
  </div>
);

export default FeatureLearningModal;

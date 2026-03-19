import { Share2, Copy, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface SocialShareButtonsProps {
  statsText: string;
  url?: string;
}

const SocialShareButtons = ({ statsText, url }: SocialShareButtonsProps) => {
  const [copied, setCopied] = useState(false);
  const shareUrl = url || window.location.origin;
  const fullText = `${statsText}\n\nTrained with @M2Training 💪\n${shareUrl}`;

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "My Workout Results", text: statsText, url: shareUrl });
      } catch {}
    }
  };

  const handleFacebook = () => {
    window.open(
      `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${encodeURIComponent(statsText)}`,
      "_blank",
      "width=600,height=400"
    );
  };

  const handleX = () => {
    window.open(
      `https://x.com/intent/tweet?text=${encodeURIComponent(fullText)}`,
      "_blank",
      "width=600,height=400"
    );
  };

  const handleInstagram = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success("Stats copied! Paste into your Instagram story.");
    setTimeout(() => setCopied(false), 3000);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullText);
    setCopied(true);
    toast.success("Copied to clipboard!");
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="space-y-2">
      <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
        Share Externally
      </span>
      <div className="flex flex-wrap gap-2">
        {navigator.share && (
          <button
            onClick={handleNativeShare}
            className="flex items-center gap-1.5 bg-primary text-primary-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
          >
            <Share2 size={12} /> Share
          </button>
        )}
        <button
          onClick={handleFacebook}
          className="flex items-center gap-1.5 bg-[hsl(221,44%,41%)] text-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
        >
          Facebook
        </button>
        <button
          onClick={handleX}
          className="flex items-center gap-1.5 bg-foreground text-background px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
        >
          X.com
        </button>
        <button
          onClick={handleInstagram}
          className="flex items-center gap-1.5 bg-gradient-to-r from-[hsl(37,97%,55%)] via-[hsl(340,75%,54%)] to-[hsl(280,72%,52%)] text-white px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-all"
        >
          Instagram
        </button>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 bg-muted text-muted-foreground px-3 py-2 text-[10px] font-bold uppercase tracking-widest hover:text-foreground transition-all"
        >
          {copied ? <Check size={12} /> : <Copy size={12} />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
    </div>
  );
};

export default SocialShareButtons;

import { useEffect, useState } from "react";
import { Download, X, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeLocalStorage } from "@/lib/browserStorage";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallAppKey = "dwa-admin" | "fielddesk" | "dwa-client";

const APP_COPY: Record<InstallAppKey, { name: string; tagline: string; accent: string }> = {
  "dwa-admin": {
    name: "DWA Admin",
    tagline: "One-tap access to your command center.",
    accent: "border-cyan-400/40 bg-cyan-400/5",
  },
  fielddesk: {
    name: "FieldDesk",
    tagline: "Install for one-tap dispatch from the truck.",
    accent: "border-orange-500/40 bg-orange-500/5",
  },
  "dwa-client": {
    name: "DWA Client",
    tagline: "Install your dashboard for instant alerts.",
    accent: "border-cyan-400/40 bg-cyan-400/5",
  },
};

/**
 * Onboarding install banner shown inside each tool's portal page.
 * Sits at the top of the first dashboard the customer lands on after
 * checkout (welcome email → dashboard link → see this prompt).
 *
 * Each app has its own dismissal key so dismissing FieldDesk doesn't
 * suppress DWA Admin, etc.
 */
export default function InstallAppBanner({ app }: { app: InstallAppKey }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const dismissKey = `install-banner-dismissed:${app}`;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (safeLocalStorage.getItem(dismissKey)) {
      setDismissed(true);
      return;
    }
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);
    const ua = window.navigator.userAgent || "";
    setIsIos(/iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, [dismissKey]);

  if (dismissed || isStandalone) return null;
  // Hide if there's no install path — Android without the event AND not iOS Safari
  if (!deferredPrompt && !isIos) return null;

  const copy = APP_COPY[app];

  const handleInstall = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === "accepted") setDeferredPrompt(null);
      setDismissed(true);
      safeLocalStorage.setItem(dismissKey, "1");
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    safeLocalStorage.setItem(dismissKey, "1");
  };

  return (
    <div className={`relative mb-4 rounded-lg border ${copy.accent} p-3 sm:p-4`}>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss"
        className="absolute right-2 top-2 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X size={16} />
      </button>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 pr-6">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="shrink-0 rounded-md bg-foreground/5 p-2">
            <Smartphone size={20} className="text-foreground" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-bold text-foreground">
              Install <span className="text-cyan-400">{copy.name}</span> on your phone
            </p>
            <p className="text-xs text-muted-foreground">{copy.tagline}</p>
          </div>
        </div>
        {deferredPrompt ? (
          <Button onClick={handleInstall} size="sm" className="shrink-0 gap-1.5">
            <Download size={14} />
            Install
          </Button>
        ) : isIos ? (
          <p className="text-xs text-muted-foreground sm:text-right shrink-0">
            Tap <span className="font-bold">Share</span> → <span className="font-bold">Add to Home Screen</span>
          </p>
        ) : null}
      </div>
    </div>
  );
}

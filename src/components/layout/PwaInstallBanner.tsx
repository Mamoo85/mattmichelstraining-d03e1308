import { useState, useEffect } from "react";
import { Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { safeSessionStorage } from "@/lib/browserStorage";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const PwaInstallBanner = ({ autoTrigger = false }: { autoTrigger?: boolean }) => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [autoTriggered, setAutoTriggered] = useState(false);

  useEffect(() => {
    if (safeSessionStorage.getItem("pwa-banner-dismissed")) {
      setDismissed(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  // Auto-trigger install prompt once per session for logged-in mobile users
  useEffect(() => {
    if (autoTrigger && deferredPrompt && !dismissed && !autoTriggered) {
      const alreadyAutoTriggered = safeSessionStorage.getItem("pwa-auto-triggered");
      if (!alreadyAutoTriggered) {
        setAutoTriggered(true);
        safeSessionStorage.setItem("pwa-auto-triggered", "1");
        deferredPrompt.prompt().then(() => {
          deferredPrompt.userChoice.then(({ outcome }) => {
            if (outcome === "accepted") setDeferredPrompt(null);
            setDismissed(true);
          });
        });
      }
    }
  }, [autoTrigger, deferredPrompt, dismissed, autoTriggered]);

  const isStandalone = window.matchMedia("(display-mode: standalone)").matches;
  if (isStandalone || dismissed || !deferredPrompt) return null;

  const handleInstall = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setDeferredPrompt(null);
    }
    setDismissed(true);
  };

  const handleDismiss = () => {
    setDismissed(true);
    safeSessionStorage.setItem("pwa-banner-dismissed", "1");
  };

  return (
    <div className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-md animate-in slide-in-from-bottom-4 duration-300 mb-[env(safe-area-inset-bottom)]">
      <div className="flex items-center gap-3 rounded-sm border border-border bg-card p-3 shadow-m2">
        <Download size={20} className="shrink-0 text-primary" />
        <p className="flex-1 text-sm text-foreground-soft">
          Install the <span className="font-bold text-foreground">M2 App</span> for a faster experience.
        </p>
        <Button size="sm" onClick={handleInstall} className="shrink-0 text-xs font-bold uppercase">
          Install
        </Button>
        <button onClick={handleDismiss} className="shrink-0 p-1 text-muted-foreground hover:text-foreground transition-m2">
          <X size={16} />
        </button>
      </div>
    </div>
  );
};

export default PwaInstallBanner;

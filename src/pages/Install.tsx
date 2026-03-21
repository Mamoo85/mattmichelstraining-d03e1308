import { useState, useEffect, lazy, Suspense } from "react";
import { Download, Share, PlusSquare, MoreVertical, CheckCircle2 } from "lucide-react";
import m2Logo from "@/assets/m2-logo.jpg";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import AppNavbar from "@/components/layout/AppNavbar";
import SEOHead from "@/components/layout/SEOHead";
const DoNotPressButton = lazy(() => import("@/components/landing/DoNotPressButton"));

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    setIsIOS(/iPad|iPhone|iPod/.test(ua));
    setIsStandalone(window.matchMedia("(display-mode: standalone)").matches);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      setInstalled(true);
      setDeferredPrompt(null);
    }
  };

  return (
    <>
      <SEOHead
        title="Install M² Training App"
        description="Install the M² Training app on your phone for quick access to workouts, progress tracking, and coaching — no app store needed."
        path="/install"
      />
      <AppNavbar />
      <main className="min-h-screen bg-background pt-20 pb-16">
        <div className="container max-w-lg mx-auto px-4">
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl overflow-hidden shadow-m2">
              <img src={m2Logo} alt="M² Training" className="w-full h-full object-cover" />
            </div>
            <h1 className="text-3xl font-heading font-black text-foreground mb-2">
              Get the M² App
            </h1>
            <p className="text-muted-foreground">
              Install directly from your browser — no app store required.
            </p>
          </div>

          {isStandalone ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-center gap-3 p-6">
                <CheckCircle2 className="text-primary shrink-0" size={28} />
                <div>
                  <p className="font-bold text-foreground">Already Installed!</p>
                  <p className="text-sm text-muted-foreground">
                    You're using the M² app right now.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : installed ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-center gap-3 p-6">
                <CheckCircle2 className="text-primary shrink-0" size={28} />
                <div>
                  <p className="font-bold text-foreground">App Installed!</p>
                  <p className="text-sm text-muted-foreground">
                    Check your home screen for the M² Training icon.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : deferredPrompt ? (
            <div className="space-y-4">
              <Button
                onClick={handleInstall}
                size="lg"
                className="w-full text-lg font-bold gap-2"
              >
                <Download size={20} />
                Install M² Training
              </Button>
              <p className="text-center text-xs text-muted-foreground">
                Works on Android, Chrome, Edge, and Samsung Internet.
              </p>
            </div>
          ) : isIOS ? (
            <Card>
              <CardContent className="p-6 space-y-6">
                <p className="font-bold text-foreground text-center">
                  Install on iPhone / iPad
                </p>
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-primary font-bold text-sm">1</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground flex items-center gap-1.5">
                        Tap the Share button <Share size={16} className="text-primary" />
                      </p>
                      <p className="text-sm text-muted-foreground">
                        At the bottom of Safari (or the top on iPad).
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-primary font-bold text-sm">2</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground flex items-center gap-1.5">
                        Tap "Add to Home Screen" <PlusSquare size={16} className="text-primary" />
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Scroll down in the share menu if you don't see it.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                      <span className="text-primary font-bold text-sm">3</span>
                    </div>
                    <div>
                      <p className="font-semibold text-foreground">Tap "Add"</p>
                      <p className="text-sm text-muted-foreground">
                        The M² app icon will appear on your home screen.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-6 space-y-4">
                <p className="font-bold text-foreground text-center">
                  Install from your browser
                </p>
                <div className="flex items-start gap-3">
                  <MoreVertical size={20} className="text-primary shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    Tap the browser menu (⋮) and select <span className="font-semibold text-foreground">"Install app"</span> or <span className="font-semibold text-foreground">"Add to Home Screen"</span>.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}

          <div className="mt-10 space-y-3">
            <h2 className="text-lg font-heading font-bold text-foreground text-center">
              Why install?
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {[
                { icon: "⚡", title: "Instant Access", desc: "Open from your home screen like a real app." },
                { icon: "📶", title: "Works Offline", desc: "Log workouts even without internet." },
                { icon: "🔔", title: "Full Screen", desc: "No browser bars — just your training." },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
                  <span className="text-xl">{item.icon}</span>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Suspense fallback={null}><DoNotPressButton /></Suspense>
    </>
  );
};

export default Install;

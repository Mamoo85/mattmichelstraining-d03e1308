import { useState, useEffect } from "react";
import { Download, Share, PlusSquare, MoreVertical, CheckCircle2, Dumbbell, BarChart3, Zap, Shield } from "lucide-react";
import m2Logo from "@/assets/m2-logo.jpg";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "react-router-dom";
import AppNavbar from "@/components/layout/AppNavbar";
import SEOHead from "@/components/layout/SEOHead";

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
        title="Install Your M2 Training Portal"
        description="Add the M2 Training Portal to your home screen for instant access to workouts, progress tracking, and coaching tools."
        path="/install"
      />
      <AppNavbar />
      <main className="min-h-screen bg-background pt-20 pb-16">
        <div className="container max-w-lg mx-auto px-4">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="w-20 h-20 mx-auto mb-4 rounded-2xl overflow-hidden shadow-m2">
              <img src={m2Logo} alt="M2 Training" className="w-full h-full object-cover" />
            </div>
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary block mb-1">
              Your Training Portal
            </span>
            <h1 className="text-2xl font-heading font-black text-foreground mb-2">
              Install the M2 App
            </h1>
            <p className="text-sm text-muted-foreground">
              Add your portal to your home screen — open it like a real app, no app store needed.
            </p>
          </div>

          {/* Install state */}
          {isStandalone ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="flex items-center gap-3 p-6">
                <CheckCircle2 className="text-primary shrink-0" size={28} />
                <div>
                  <p className="font-bold text-foreground">Already Installed!</p>
                  <p className="text-sm text-muted-foreground">
                    You're using the M2 app right now.
                  </p>
                </div>
              </CardContent>
            </Card>
          ) : installed ? (
            <Card className="border-primary/30 bg-primary/5">
              <CardContent className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-primary shrink-0" size={28} />
                  <div>
                    <p className="font-bold text-foreground">App Installed!</p>
                    <p className="text-sm text-muted-foreground">
                      Check your home screen for the M2 icon.
                    </p>
                  </div>
                </div>
                <Link to="/dashboard">
                  <Button className="w-full gap-2 font-bold">
                    <Dumbbell size={16} /> Open Your Portal
                  </Button>
                </Link>
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
                Install M2 Portal
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
                        The M2 app icon will appear on your home screen.
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

          {/* Portal benefits */}
          <div className="mt-10 space-y-3">
            <h2 className="text-sm font-bold uppercase tracking-widest text-foreground text-center">
              Your portal, one tap away
            </h2>
            <div className="grid grid-cols-1 gap-3">
              {[
                { icon: <Dumbbell size={18} className="text-primary" />, title: "Programs & Workouts", desc: "Access your structured training instantly." },
                { icon: <BarChart3 size={18} className="text-primary" />, title: "Track Progress", desc: "Log lifts, see PRs, and monitor gains." },
                { icon: <Zap size={18} className="text-primary" />, title: "AI Tools", desc: "Workout generator, Fix-It protocols, and nutrition scanner." },
                { icon: <Shield size={18} className="text-primary" />, title: "Full-Screen & Offline", desc: "No browser bars. Works without internet." },
              ].map((item) => (
                <div key={item.title} className="flex items-start gap-3 p-3 rounded-lg bg-card border border-border">
                  <div className="shrink-0 mt-0.5">{item.icon}</div>
                  <div>
                    <p className="font-semibold text-foreground text-sm">{item.title}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* CTA to portal */}
          <div className="mt-8 text-center">
            <Link to="/dashboard">
              <Button variant="outline" className="gap-2 font-bold text-sm">
                <Dumbbell size={14} /> Go to Your Portal
              </Button>
            </Link>
          </div>
        </div>
      </main>
    </>
  );
};

export default Install;

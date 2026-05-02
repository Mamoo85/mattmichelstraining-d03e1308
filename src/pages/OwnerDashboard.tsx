import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LockedPriceBadge } from "@/components/LockedPriceBadge";
import { WhatsNewBanner } from "@/components/WhatsNewBanner";
import { LogOut, ExternalLink } from "lucide-react";

interface Session { email: string; exp: number; }

export default function OwnerDashboard() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const [tiles, setTiles] = useState<any[]>([]);

  useEffect(() => {
    const raw = localStorage.getItem("owner_session");
    if (!raw) { navigate("/owner/login"); return; }
    try {
      const s: Session = JSON.parse(atob(raw));
      if (s.exp < Date.now()) { localStorage.removeItem("owner_session"); navigate("/owner/login"); return; }
      setEmail(s.email);
      // Load command center tiles for this owner
      (supabase as any)
        .from("command_center_tiles")
        .select("*")
        .eq("owner_email", s.email)
        .eq("is_active", true)
        .order("sort_order")
        .then(({ data }: any) => setTiles(data || []));
    } catch {
      navigate("/owner/login");
    }
  }, [navigate]);

  const logout = () => {
    localStorage.removeItem("owner_session");
    localStorage.removeItem("owner_email");
    navigate("/owner/login");
  };

  if (!email) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/40 bg-card/30">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Signed in as</p>
            <p className="font-semibold">{email}</p>
          </div>
          <Button variant="ghost" size="sm" onClick={logout}><LogOut className="h-4 w-4 mr-2" />Sign out</Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-6">
        <LockedPriceBadge clientEmail={email} />
        <WhatsNewBanner />

        <section>
          <h2 className="text-xl font-bold mb-4">Command Center</h2>
          {tiles.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground mb-3">Your command center is empty.</p>
              <p className="text-sm text-muted-foreground">Matt will sync your most-used tools here shortly.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {tiles.map((t) => (
                <a key={t.id} href={t.url} target="_blank" rel="noopener noreferrer" className="block">
                  <Card className="p-5 hover:border-primary/50 transition-colors h-full">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-2xl">{t.icon || "🔗"}</span>
                      <ExternalLink className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <p className="font-semibold text-sm">{t.title}</p>
                    {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                  </Card>
                </a>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}

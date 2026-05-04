import { useEffect, useState } from "react";
import { Helmet } from "react-helmet-async";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Mail, Trash2, Users, Plus } from "lucide-react";

interface Member {
  id: string;
  member_email: string;
  status: "invited" | "active" | "revoked";
  role: string;
  invited_at: string;
  accepted_at: string | null;
}

export default function MyTeam() {
  const [loading, setLoading] = useState(true);
  const [members, setMembers] = useState<Member[]>([]);
  const [seatCap, setSeatCap] = useState(10);
  const [email, setEmail] = useState("");
  const [inviting, setInviting] = useState(false);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("team-seat-manager", {
      body: { action: "list" },
    });
    if (error) {
      toast.error("Couldn't load team");
    } else {
      setMembers((data as any)?.members || []);
      setSeatCap((data as any)?.seat_cap || 10);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const invite = async () => {
    const e = email.trim().toLowerCase();
    if (!e) return;
    setInviting(true);
    const { data, error } = await supabase.functions.invoke("team-seat-manager?action=invite", {
      body: { email: e },
    });
    setInviting(false);
    if (error || (data as any)?.error) {
      const msg = (data as any)?.error || error?.message || "Invite failed";
      toast.error(msg === "seat_cap_reached" ? `Seat cap reached (${seatCap})` : msg);
      return;
    }
    toast.success(`Invited ${e}`);
    setEmail("");
    load();
  };

  const revoke = async (id: string, e: string) => {
    if (!confirm(`Revoke access for ${e}?`)) return;
    const { error } = await supabase.functions.invoke("team-seat-manager?action=revoke", {
      body: { id },
    });
    if (error) toast.error("Revoke failed");
    else {
      toast.success("Access revoked");
      load();
    }
  };

  const active = members.filter((m) => m.status !== "revoked");

  return (
    <div className="min-h-screen bg-background text-foreground">
      <Helmet>
        <title>Team Seats · Detroit Web Agency</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <div className="container max-w-2xl mx-auto px-4 py-10">
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-6 h-6 text-primary" />
          <h1 className="text-2xl font-bold">Team Seats</h1>
        </div>
        <p className="text-sm text-muted-foreground mb-6">
          Share your subscription with up to {seatCap} teammates. Flat fee — no extra cost per seat.
        </p>

        <Card className="p-5 mb-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider mb-3">Invite a teammate</h2>
          <div className="flex gap-2">
            <Input
              type="email"
              value={email}
              placeholder="teammate@company.com"
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && invite()}
            />
            <Button onClick={invite} disabled={inviting || !email}>
              {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Invite
            </Button>
          </div>
        </Card>

        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold uppercase tracking-wider">
              Members ({active.length}/{seatCap})
            </h2>
          </div>
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">
              <Loader2 className="w-5 h-5 animate-spin inline mr-2" /> Loading…
            </div>
          ) : members.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No teammates yet. Invite one above.
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {members.map((m) => (
                <li key={m.id} className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{m.member_email}</div>
                      <div className="text-xs text-muted-foreground">
                        {m.status === "active" && m.accepted_at
                          ? `Joined ${new Date(m.accepted_at).toLocaleDateString()}`
                          : `Invited ${new Date(m.invited_at).toLocaleDateString()}`}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge
                      variant={
                        m.status === "active"
                          ? "default"
                          : m.status === "revoked"
                            ? "outline"
                            : "secondary"
                      }
                    >
                      {m.status}
                    </Badge>
                    {m.status !== "revoked" && (
                      <Button
                        size="icon"
                        variant="ghost"
                        onClick={() => revoke(m.id, m.member_email)}
                        title="Revoke access"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

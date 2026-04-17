import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { UserPlus, CheckCircle2, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  clientId?: string;
}

/**
 * Batch 4 TR-16/19/20 — AI recruiter, hire confirm, multi-seat.
 */
export const TalentRadarBatch4 = ({ clientId }: Props) => {
  const [members, setMembers] = useState<any[]>([]);
  const [confirmations, setConfirmations] = useState<any[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");

  useEffect(() => {
    if (clientId) {
      void load();
    }
  }, [clientId]);

  const load = async () => {
    const [m, c] = await Promise.all([
      supabase.from("radar_team_members" as any).select("*").eq("client_id", clientId).order("invited_at", { ascending: false }),
      supabase.from("radar_hire_confirmations" as any).select("*").eq("client_id", clientId).is("responded_at", null).order("prompted_at", { ascending: false }).limit(5),
    ]);
    setMembers((m.data as any) || []);
    setConfirmations((c.data as any) || []);
  };

  const inviteMember = async () => {
    if (!clientId || !inviteEmail.trim()) return;
    const { error } = await supabase.from("radar_team_members" as any).insert({
      client_id: clientId,
      email: inviteEmail.trim().toLowerCase(),
      name: inviteName.trim() || null,
      role: "recruiter",
    });
    if (error) { toast.error(error.message.includes("duplicate") ? "Already invited" : "Failed"); return; }
    setInviteEmail(""); setInviteName("");
    await load();
    toast.success("Teammate invited");
  };

  const confirmHire = async (id: string, outcome: "hired" | "passed") => {
    const { error } = await supabase
      .from("radar_hire_confirmations" as any)
      .update({ outcome, responded_at: new Date().toISOString() })
      .eq("id", id);
    if (error) { toast.error("Failed"); return; }
    toast.success(outcome === "hired" ? "Hire confirmed — added to ROI ledger" : "Marked as passed");
    await load();
  };

  return (
    <div className="space-y-4">
      {/* Pending hire confirmations */}
      {confirmations.length > 0 && (
        <Card className="p-5 bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/30">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <h3 className="text-sm font-semibold uppercase tracking-wide">Confirm Your Hires</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-3">14 days ago you viewed these candidates. Did you hire them? Each confirmed hire = $8k ROI on your dashboard.</p>
          <div className="space-y-2">
            {confirmations.map((c) => (
              <div key={c.id} className="p-3 rounded bg-muted/20 flex items-center justify-between gap-2 flex-wrap">
                <div className="text-sm font-medium">{c.candidate_name || "Candidate"}</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="default" onClick={() => confirmHire(c.id, "hired")} className="bg-emerald-600 hover:bg-emerald-700">✓ Hired</Button>
                  <Button size="sm" variant="outline" onClick={() => confirmHire(c.id, "passed")}>Passed</Button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Multi-seat invite */}
      <Card className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <UserPlus className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold uppercase tracking-wide">Recruiter Team Seats</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-3">Add teammates so they get alerts directly.</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          <Input placeholder="teammate@company.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
          <Input placeholder="Name (optional)" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
        </div>
        <Button size="sm" onClick={inviteMember} disabled={!clientId} className="mb-3">
          <UserPlus className="h-3 w-3 mr-1" /> Invite
        </Button>
        {members.length === 0 ? (
          <p className="text-xs text-muted-foreground">No teammates yet.</p>
        ) : (
          <div className="space-y-1.5">
            {members.map((m) => (
              <div key={m.id} className="text-xs p-2 rounded bg-muted/20 flex items-center justify-between">
                <span><strong>{m.name || m.email}</strong> · {m.email}</span>
                <Badge variant={m.accepted_at ? "default" : "outline"}>{m.accepted_at ? "Active" : "Invited"}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* AI Recruiter Agent note */}
      <Card className="p-4 bg-gradient-to-br from-primary/10 to-transparent border-primary/20">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="h-3 w-3 text-primary" />
          <span className="text-xs uppercase tracking-wide text-primary">AI Recruiter Agent</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Click any candidate card → "Draft outreach" → Gemini writes a personalized SMS + email in 3 seconds. Copy-paste and send.
        </p>
      </Card>
    </div>
  );
};

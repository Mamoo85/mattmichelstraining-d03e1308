import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Copy, Check, Loader2, UserPlus, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

const AdminClientOnboarding = () => {
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ email: string; message: string } | null>(null);

  const handleInvite = async () => {
    if (!email.trim()) {
      toast({ title: "Enter an email address", variant: "destructive" });
      return;
    }
    setLoading(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("admin-user-manage", {
        body: {
          action: "invite_in_person",
          targetEmail: email.trim(),
          targetName: name.trim() || null,
        },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      setResult({ email: email.trim(), message: data?.message || "Invite sent" });
      toast({ title: "In-person client invited", description: `${email.trim()} is set up with Basic access.` });
      setEmail("");
      setName("");
    } catch (e: any) {
      toast({ title: "Failed to invite", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <UserPlus size={16} className="text-primary" />
          <CardTitle className="text-sm">In-Person Client Invite</CardTitle>
        </div>
        <CardDescription className="text-[11px]">
          Enter a client's email to instantly give them Basic-tier portal access. They'll get a magic link to sign in — no signup friction, no popups, no trial banners.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-3">
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Client Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="athlete@example.com"
            className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Name (optional)</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="First Last"
            className="w-full bg-muted border border-border px-3 py-2.5 text-sm text-foreground focus:ring-1 focus:ring-primary outline-none"
          />
        </div>

        <Button
          onClick={handleInvite}
          disabled={loading || !email.trim()}
          className="w-full"
        >
          {loading ? <Loader2 size={14} className="animate-spin mr-2" /> : <Send size={14} className="mr-2" />}
          Send In-Person Invite
        </Button>

        {result && (
          <div className="bg-primary/10 border border-primary/20 p-3 animate-in fade-in-50 slide-in-from-bottom-2 duration-200">
            <p className="text-xs font-bold text-foreground">✓ {result.message}</p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {result.email} now has Basic access. They'll receive a magic link to sign in.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AdminClientOnboarding;

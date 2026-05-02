import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Lock, Mail, CheckCircle2 } from "lucide-react";

export default function OwnerLogin() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    try {
      await supabase.functions.invoke("owner-magic-link-request", { body: { email } });
      setSent(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8 border-primary/20">
        <div className="flex justify-center mb-6">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <Lock className="h-7 w-7 text-primary" />
          </div>
        </div>
        <h1 className="text-2xl font-bold text-center mb-2">Owner Dashboard</h1>
        <p className="text-sm text-muted-foreground text-center mb-6">
          Enter your email and we'll send you a one-click sign-in link.
        </p>

        {sent ? (
          <div className="text-center py-6">
            <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-3" />
            <p className="font-semibold mb-1">Check your inbox</p>
            <p className="text-sm text-muted-foreground">If your email is on file, a login link is on its way. Expires in 15 minutes.</p>
          </div>
        ) : (
          <form onSubmit={submit} className="space-y-4">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input type="email" required placeholder="you@yourcompany.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pl-10" />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? "Sending..." : "Send Magic Link"}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

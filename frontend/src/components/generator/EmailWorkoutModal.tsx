import { useState } from "react";
import { Mail, Loader2, CheckCircle2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface GeneratedProgram {
  title: string;
  description: string;
  days: { dayLabel: string; exercises: { title: string; sets: string; reps: string; notes?: string; phase?: string }[] }[];
}

interface EmailWorkoutModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  program: GeneratedProgram;
  onSent: () => void;
}

const EmailWorkoutModal = ({ open, onOpenChange, program, onSent }: EmailWorkoutModalProps) => {
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    if (!email) return;
    setSending(true);
    setError(null);
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-workout-email`;
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
        body: JSON.stringify({ firstName, email, program }),
      });
      if (!resp.ok) {
        const d = await resp.json().catch(() => ({}));
        throw new Error(d.error || "Failed to send email");
      }
      onSent();
      onOpenChange(false);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <Mail size={18} className="text-primary" /> Email This Workout
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          We'll send your custom <span className="font-bold text-foreground">{program.title}</span> workout straight to your inbox.
        </p>
        <div className="space-y-3 mt-2">
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">First Name</label>
            <Input
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Matt"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Email *</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          {error && <p className="text-destructive text-xs">{error}</p>}
          <Button
            onClick={handleSend}
            disabled={sending || !email}
            className="w-full font-bold"
          >
            {sending ? (
              <span className="flex items-center gap-2"><Loader2 className="animate-spin" size={16} /> Sending...</span>
            ) : (
              <span className="flex items-center gap-2"><Mail size={16} /> Send My Workout</span>
            )}
          </Button>
          <p className="text-[10px] text-muted-foreground text-center">
            No spam. Just your workout + a link to track it in the portal.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default EmailWorkoutModal;

import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Loader2, UserCheck } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface NamePromptModalProps {
  open: boolean;
  onComplete: () => void;
}

const NamePromptModal = ({ open, onComplete }: NamePromptModalProps) => {
  const { user } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [keepPrivate, setKeepPrivate] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (!user || !firstName.trim() || !lastName.trim()) return;
    setSaving(true);
    try {
      const fullName = `${firstName.trim()} ${lastName.trim()}`;

      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ full_name: fullName })
        .eq("user_id", user.id);
      if (profileErr) throw profileErr;

      // Update privacy setting
      const { error: privErr } = await supabase
        .from("user_privacy_settings" as any)
        .update({ show_name: !keepPrivate } as any)
        .eq("user_id", user.id);
      if (privErr) {
        // If no row exists, insert
        await supabase
          .from("user_privacy_settings" as any)
          .insert({ user_id: user.id, show_name: !keepPrivate } as any);
      }

      toast({ title: "You're all set!", description: "Your name has been saved." });
      onComplete();
    } catch (err: any) {
      toast({ title: "Failed to save", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const isValid = firstName.trim().length > 0 && lastName.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className="max-w-sm"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
        // Hide the X button
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <UserCheck size={18} className="text-primary" />
            Let's get you set up
          </DialogTitle>
          <DialogDescription className="text-xs leading-relaxed">
            Matt needs your name to keep things organized and personalize your training. Your name is private if you want it to be — but Matt always sees it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <div className="space-y-2">
            <Label htmlFor="firstName" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              First Name
            </Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="First name"
              maxLength={50}
              autoFocus
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="lastName" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
              Last Name
            </Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Last name"
              maxLength={50}
            />
          </div>

          <div className="flex items-center justify-between bg-muted p-3">
            <div className="flex-1 mr-3">
              <p className="text-xs font-bold text-foreground">Keep my name private</p>
              <p className="text-[10px] text-muted-foreground">Other athletes will see a random alias instead</p>
            </div>
            <Switch checked={keepPrivate} onCheckedChange={setKeepPrivate} />
          </div>

          <button
            onClick={handleSave}
            disabled={!isValid || saving}
            className="w-full bg-primary text-primary-foreground py-2.5 text-sm font-bold uppercase tracking-widest disabled:opacity-50 transition-all hover:opacity-90 flex items-center justify-center gap-2"
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {saving ? "Saving..." : "Continue"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default NamePromptModal;

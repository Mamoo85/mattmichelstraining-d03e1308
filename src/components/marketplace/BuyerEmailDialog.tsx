import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

interface BuyerEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: (email: string) => void;
  defaultEmail?: string;
  title?: string;
  description?: string;
}

/**
 * Mobile-safe email capture for marketplace flows.
 * Replaces window.prompt() (blocked on iOS Safari).
 */
export function BuyerEmailDialog({
  open,
  onOpenChange,
  onConfirm,
  defaultEmail = "",
  title = "Enter your email",
  description = "Where should we send the unlocked dossier?",
}: BuyerEmailDialogProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setEmail(defaultEmail);
      setError("");
    }
  }, [open, defaultEmail]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!trimmed || !trimmed.includes("@") || !trimmed.includes(".")) {
      setError("Please enter a valid email address");
      return;
    }
    onConfirm(trimmed);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="buyer-email">Email</Label>
            <Input
              id="buyer-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              placeholder="you@example.com"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                if (error) setError("");
              }}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit">Continue</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

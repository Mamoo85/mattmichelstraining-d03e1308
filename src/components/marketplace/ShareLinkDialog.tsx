import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Copy, Check, Mail, MessageSquare, ShieldCheck } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  url: string | null;
  expiresAt?: string | null;
}

export function ShareLinkDialog({ open, onOpenChange, url, expiresAt }: Props) {
  const [copied, setCopied] = useState(false);

  const subject = "Marketplace lead dossier (redacted preview)";
  const body = `Take a look at this lead I just unlocked — full intel, contact info hidden:\n\n${url || ""}\n\nLink expires in 7 days.`;

  const handleCopy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      toast.success("Link copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };

  const days = expiresAt
    ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86_400_000))
    : 7;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-intel-teal" />
            Share redacted dossier
          </DialogTitle>
          <DialogDescription>
            Contact info is hidden — only intel + scores are visible. Link expires in {days} day{days === 1 ? "" : "s"}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex gap-2">
            <Input value={url || ""} readOnly className="font-mono text-xs" onFocus={(e) => e.currentTarget.select()} />
            <Button onClick={handleCopy} variant="outline" size="icon" disabled={!url}>
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            </Button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" disabled={!url}>
              <a href={`mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`}>
                <Mail className="w-4 h-4 mr-2" /> Email
              </a>
            </Button>
            <Button asChild variant="outline" disabled={!url}>
              <a href={`sms:?&body=${encodeURIComponent(body)}`}>
                <MessageSquare className="w-4 h-4 mr-2" /> Text
              </a>
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            You're the verified owner. If the recipient tries to abuse the link, it auto-revokes after 8 attempts.
            You can revoke anytime from your receipts inbox.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

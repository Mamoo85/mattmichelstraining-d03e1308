import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ConfirmActionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string | React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  loading?: boolean;
  destructive?: boolean;
  icon?: React.ReactNode;
}

const ConfirmActionModal = ({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  loading = false,
  destructive = false,
  icon,
}: ConfirmActionModalProps) => {
  const handleCancel = () => {
    if (!loading) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className={destructive ? "flex items-center gap-2 text-destructive" : "flex items-center gap-2"}>
            {icon}
            {title}
          </DialogTitle>
          {typeof description === "string" ? (
            <DialogDescription>{description}</DialogDescription>
          ) : (
            <div className="text-sm text-muted-foreground">{description}</div>
          )}
        </DialogHeader>

        <DialogFooter>
          <Button variant="outline" onClick={handleCancel} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            onClick={onConfirm}
            disabled={loading}
            variant={destructive ? "destructive" : "default"}
          >
            {loading && <Loader2 size={14} className="mr-1.5 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default ConfirmActionModal;

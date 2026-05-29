import { toast } from "@/components/ui/use-toast";

export function toastSuccess(message: string): void {
  toast({ title: message, variant: "default" });
}

export function toastError(message: string): void {
  toast({ title: message, variant: "destructive" });
}

export function toastInfo(message: string): void {
  toast({ title: message });
}

// Standardized toast helpers. Sonner is mounted globally in App.tsx.
// Use these instead of importing `toast` directly so success/error/info
// styling and durations stay consistent across the product.

import { toast } from "sonner";

const BASE = {
  duration: 4500,
  // Sonner positions globally; per-toast position works on mobile too.
  position: "top-center" as const,
  dismissible: true,
};

export function toastSuccess(message: string, description?: string) {
  return toast.success(message, { ...BASE, description });
}

export function toastError(message: string, description?: string) {
  return toast.error(message, {
    ...BASE,
    duration: 6000,
    description: description ?? "Text Matt at (313) 992-1219 if this keeps happening.",
  });
}

export function toastInfo(message: string, description?: string) {
  return toast(message, { ...BASE, description });
}

export function toastLoading(message: string) {
  return toast.loading(message, { position: "top-center" });
}

export { toast };

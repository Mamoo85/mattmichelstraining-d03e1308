import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { safeLocalStorage } from "@/lib/browserStorage";
import { resolveCoupon } from "../data/coupons";

export interface CartLine {
  key: string; // productId + personalization hash
  productId: string;
  title: string;
  image: string;
  unitPrice: number;
  qty: number;
  personalization?: { text: string; font: string; material: string };
  previewDataUrl?: string;
}

interface CartCtx {
  lines: CartLine[];
  add: (line: CartLine) => void;
  remove: (key: string) => void;
  setQty: (key: string, qty: number) => void;
  clear: () => void;
  miniOpen: boolean;
  setMiniOpen: (b: boolean) => void;
  coupon: string | null;
  applyCoupon: (code: string) => string | null; // returns error or null
  clearCoupon: () => void;
  subtotal: number;
  shipping: number;
  discount: number;
  total: number;
  couponLabel: string | null;
  itemCount: number;
}

const Ctx = createContext<CartCtx | null>(null);
const KEY = "gg.cart.v1";
const COUPON_KEY = "gg.coupon.v1";
const BASE_SHIPPING = 8;

export function GuildGrainProvider({ children }: { children: ReactNode }) {
  const [lines, setLines] = useState<CartLine[]>(() => {
    const raw = safeLocalStorage.getItem(KEY);
    if (!raw) return [];
    try { return JSON.parse(raw); } catch { return []; }
  });
  const [coupon, setCoupon] = useState<string | null>(() => safeLocalStorage.getItem(COUPON_KEY));
  const [miniOpen, setMiniOpen] = useState(false);

  useEffect(() => { safeLocalStorage.setItem(KEY, JSON.stringify(lines)); }, [lines]);
  useEffect(() => {
    if (coupon) safeLocalStorage.setItem(COUPON_KEY, coupon);
    else safeLocalStorage.removeItem(COUPON_KEY);
  }, [coupon]);

  const add = useCallback((line: CartLine) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.key === line.key);
      if (existing) return prev.map((l) => l.key === line.key ? { ...l, qty: l.qty + line.qty } : l);
      return [...prev, line];
    });
    setMiniOpen(true);
  }, []);
  const remove = useCallback((key: string) => setLines((p) => p.filter((l) => l.key !== key)), []);
  const setQty = useCallback((key: string, qty: number) => {
    if (qty <= 0) { setLines((p) => p.filter((l) => l.key !== key)); return; }
    setLines((p) => p.map((l) => l.key === key ? { ...l, qty } : l));
  }, []);
  const clear = useCallback(() => { setLines([]); setCoupon(null); }, []);

  const subtotal = useMemo(() => lines.reduce((s, l) => s + l.unitPrice * l.qty, 0), [lines]);
  const resolved = useMemo(() => resolveCoupon(coupon, subtotal, lines.length > 0 ? BASE_SHIPPING : 0), [coupon, subtotal, lines.length]);
  const shipping = resolved.shipping;
  const discount = resolved.discount;
  const total = Math.max(0, subtotal - discount + shipping);

  const applyCoupon = useCallback((code: string) => {
    const r = resolveCoupon(code, subtotal, lines.length > 0 ? BASE_SHIPPING : 0);
    if (r.error) return r.error;
    setCoupon(code.toUpperCase());
    return null;
  }, [subtotal, lines.length]);

  const clearCoupon = useCallback(() => setCoupon(null), []);

  const itemCount = lines.reduce((s, l) => s + l.qty, 0);

  return (
    <Ctx.Provider value={{ lines, add, remove, setQty, clear, miniOpen, setMiniOpen, coupon, applyCoupon, clearCoupon, subtotal, shipping, discount, total, couponLabel: resolved.applied?.label ?? null, itemCount }}>
      {children}
    </Ctx.Provider>
  );
}

export function useGGCart() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useGGCart outside GuildGrainProvider");
  return v;
}

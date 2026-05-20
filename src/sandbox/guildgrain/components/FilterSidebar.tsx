import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { AESTHETICS } from "../data/aesthetics";

export interface ShopFilters {
  price: [number, number];
  categories: Set<string>;
  occasions: Set<string>;
  aesthetics: Set<string>;
}

const CATEGORIES = [
  { id: "kitchen", label: "Kitchen" },
  { id: "decor", label: "Home Decor" },
  { id: "candles", label: "Candles" },
  { id: "jewelry", label: "Jewelry" },
  { id: "stationery", label: "Stationery" },
];
const OCCASIONS = [
  { id: "wedding", label: "Wedding" },
  { id: "anniversary", label: "Anniversary" },
  { id: "birthday", label: "Birthday" },
  { id: "housewarming", label: "Housewarming" },
  { id: "everyday", label: "Everyday" },
];

interface Props {
  filters: ShopFilters;
  onChange: (f: ShopFilters) => void;
}

function toggle(set: Set<string>, id: string) {
  const next = new Set(set);
  if (next.has(id)) next.delete(id); else next.add(id);
  return next;
}

export default function FilterSidebar({ filters, onChange }: Props) {
  const [priceDraft, setPriceDraft] = useState<[number, number]>(filters.price);
  return (
    <aside className="space-y-6 text-sm" data-testid="gg-filters">
      <section>
        <h3 className="gg-serif mb-3 text-lg">Price</h3>
        <Slider min={0} max={200} step={2} value={priceDraft} onValueChange={(v) => { const tup: [number, number] = [v[0], v[1]]; setPriceDraft(tup); onChange({ ...filters, price: tup }); }} data-testid="gg-price-slider" />
        <div className="mt-2 flex justify-between text-xs text-[var(--gg-mute)]">
          <span data-testid="gg-price-min">${priceDraft[0]}</span>
          <span data-testid="gg-price-max">${priceDraft[1]}</span>
        </div>
      </section>

      <section>
        <h3 className="gg-serif mb-3 text-lg">Category</h3>
        <ul className="space-y-1.5">
          {CATEGORIES.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={filters.categories.has(c.id)} onChange={() => onChange({ ...filters, categories: toggle(filters.categories, c.id) })} data-testid={`gg-cat-${c.id}`} />
                <span>{c.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="gg-serif mb-3 text-lg">Occasion</h3>
        <ul className="space-y-1.5">
          {OCCASIONS.map((c) => (
            <li key={c.id}>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={filters.occasions.has(c.id)} onChange={() => onChange({ ...filters, occasions: toggle(filters.occasions, c.id) })} />
                <span>{c.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="gg-serif mb-3 text-lg">Aesthetic</h3>
        <ul className="space-y-1.5">
          {AESTHETICS.map((a) => (
            <li key={a.id}>
              <label className="flex cursor-pointer items-center gap-2">
                <input type="checkbox" checked={filters.aesthetics.has(a.id)} onChange={() => onChange({ ...filters, aesthetics: toggle(filters.aesthetics, a.id) })} />
                <span>{a.label}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}

export function defaultFilters(): ShopFilters {
  return { price: [0, 200], categories: new Set(), occasions: new Set(), aesthetics: new Set() };
}

export function applyFilters<T extends { basePrice: number; category: string; occasion: string[]; aesthetic: string[] }>(items: T[], f: ShopFilters): T[] {
  return items.filter((p) => {
    if (p.basePrice < f.price[0] || p.basePrice > f.price[1]) return false;
    if (f.categories.size && !f.categories.has(p.category)) return false;
    if (f.occasions.size && !p.occasion.some((o) => f.occasions.has(o))) return false;
    if (f.aesthetics.size && !p.aesthetic.some((a) => f.aesthetics.has(a))) return false;
    return true;
  });
}

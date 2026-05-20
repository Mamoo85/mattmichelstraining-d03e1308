import { useMemo, useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { PRODUCTS } from "../data/products";
import ProductCard from "../components/ProductCard";
import FilterSidebar, { defaultFilters, applyFilters, ShopFilters } from "../components/FilterSidebar";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { SlidersHorizontal } from "lucide-react";

export default function GGShop() {
  const [params] = useSearchParams();
  const [filters, setFilters] = useState<ShopFilters>(defaultFilters());

  useEffect(() => {
    const a = params.get("aesthetic");
    if (a) setFilters((f) => ({ ...f, aesthetics: new Set([a]) }));
  }, [params]);

  const filtered = useMemo(() => applyFilters(PRODUCTS, filters), [filters]);

  return (
    <div>
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="gg-serif text-4xl">The Collection</h1>
          <p className="mt-1 text-sm text-[var(--gg-mute)]" data-testid="gg-result-count">{filtered.length} of {PRODUCTS.length} items</p>
        </div>
        <Sheet>
          <SheetTrigger asChild>
            <button className="gg-btn gg-btn--ghost md:hidden" data-testid="gg-mobile-filter-btn"><SlidersHorizontal className="h-4 w-4" /> Filters</button>
          </SheetTrigger>
          <SheetContent side="left" className="gg-theme w-[88vw] max-w-sm overflow-y-auto bg-[var(--gg-cream)]">
            <SheetHeader><SheetTitle className="gg-serif">Filter</SheetTitle></SheetHeader>
            <div className="mt-4"><FilterSidebar filters={filters} onChange={setFilters} /></div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="grid gap-8 md:grid-cols-[220px_1fr]">
        <div className="hidden md:block"><FilterSidebar filters={filters} onChange={setFilters} /></div>
        <div>
          {filtered.length === 0 ? (
            <p className="py-20 text-center text-[var(--gg-mute)]">No items match these filters.</p>
          ) : (
            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4" data-testid="gg-product-grid">
              {filtered.map((p) => <ProductCard key={p.id} product={p} />)}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

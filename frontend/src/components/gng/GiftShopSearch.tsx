import { useState, useEffect, useMemo } from "react";
import Fuse from "fuse.js";

interface Listing {
  listing_id: string;
  title: string;
  price_usd: number;
  listing_url: string;
  main_image: string | null;
  tags?: string[];
}

interface Props {
  allListings: Listing[];
  onResults: (results: Listing[] | null) => void; // null = clear search, show defaults
}

export default function GiftShopSearch({ allListings, onResults }: Props) {
  const [query, setQuery] = useState("");

  const fuse = useMemo(() => {
    return new Fuse(allListings, {
      keys: ["title", "tags"],
      threshold: 0.35,        // fuzzy: "nurese" → finds "nurse"
      includeScore: true,
      minMatchCharLength: 2,
    });
  }, [allListings]);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      onResults(null);
      return;
    }
    const results = fuse.search(trimmed).map((r) => r.item);
    onResults(results);
  }, [query, fuse, onResults]);

  return (
    <div className="relative w-full max-w-lg mx-auto">
      <div className="relative">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
          />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search gifts (e.g. nurse, dog mom, mug…)"
          className="w-full pl-10 pr-4 py-3 rounded-full border border-gray-200 bg-white shadow-sm text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent"
        />
        {query && (
          <button
            onClick={() => setQuery("")}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            aria-label="Clear search"
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

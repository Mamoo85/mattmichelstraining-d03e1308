import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import GiftShopSearch from "../GiftShopSearch";

const MOCK_LISTINGS = [
  { listing_id: "1", title: "Funny Nurse Mug Gift", price_usd: 18.99, listing_url: "https://etsy.com/1", main_image: null, tags: ["nurse", "mug", "gift"] },
  { listing_id: "2", title: "Dog Mom Socks Birthday", price_usd: 14.99, listing_url: "https://etsy.com/2", main_image: null, tags: ["dog", "mom", "socks"] },
  { listing_id: "3", title: "Teacher Appreciation Shirt", price_usd: 22.99, listing_url: "https://etsy.com/3", main_image: null, tags: ["teacher", "shirt"] },
  { listing_id: "4", title: "Retirement Coffee Tumbler", price_usd: 29.99, listing_url: "https://etsy.com/4", main_image: null, tags: ["retirement", "coffee"] },
];

describe("GiftShopSearch", () => {
  it("renders search input", () => {
    render(<GiftShopSearch allListings={MOCK_LISTINGS} onResults={vi.fn()} />);
    expect(screen.getByPlaceholderText(/search gifts/i)).toBeTruthy();
  });

  it("calls onResults(null) when query is empty", () => {
    const onResults = vi.fn();
    render(<GiftShopSearch allListings={MOCK_LISTINGS} onResults={onResults} />);
    expect(onResults).toHaveBeenCalledWith(null);
  });

  it("filters by title on input — 'nurse' finds nurse listing", () => {
    const onResults = vi.fn();
    render(<GiftShopSearch allListings={MOCK_LISTINGS} onResults={onResults} />);

    fireEvent.change(screen.getByPlaceholderText(/search gifts/i), { target: { value: "nurse" } });

    const lastCall = onResults.mock.calls[onResults.mock.calls.length - 1][0] as typeof MOCK_LISTINGS | null;
    expect(lastCall).not.toBeNull();
    expect(lastCall?.some((l) => l.listing_id === "1")).toBe(true);
  });

  it("handles typos — 'nurese' still finds nurse listing (fuzzy match)", () => {
    const onResults = vi.fn();
    render(<GiftShopSearch allListings={MOCK_LISTINGS} onResults={onResults} />);

    fireEvent.change(screen.getByPlaceholderText(/search gifts/i), { target: { value: "nurese" } });

    const lastCall = onResults.mock.calls[onResults.mock.calls.length - 1][0] as typeof MOCK_LISTINGS | null;
    // Fuse.js with threshold 0.35 should match "nurse" from "nurese"
    expect(lastCall).not.toBeNull();
    expect(lastCall?.length).toBeGreaterThan(0);
  });

  it("returns empty array when no matches", () => {
    const onResults = vi.fn();
    render(<GiftShopSearch allListings={MOCK_LISTINGS} onResults={onResults} />);

    fireEvent.change(screen.getByPlaceholderText(/search gifts/i), { target: { value: "zzzzzzzzz" } });

    const lastCall = onResults.mock.calls[onResults.mock.calls.length - 1][0] as typeof MOCK_LISTINGS | null;
    expect(lastCall).toEqual([]);
  });

  it("shows clear button when query is non-empty", () => {
    render(<GiftShopSearch allListings={MOCK_LISTINGS} onResults={vi.fn()} />);
    fireEvent.change(screen.getByPlaceholderText(/search gifts/i), { target: { value: "mug" } });
    expect(screen.getByLabelText("Clear search")).toBeTruthy();
  });

  it("clears results when X is clicked", () => {
    const onResults = vi.fn();
    render(<GiftShopSearch allListings={MOCK_LISTINGS} onResults={onResults} />);
    fireEvent.change(screen.getByPlaceholderText(/search gifts/i), { target: { value: "mug" } });
    fireEvent.click(screen.getByLabelText("Clear search"));
    const lastCall = onResults.mock.calls[onResults.mock.calls.length - 1][0];
    expect(lastCall).toBeNull();
  });
});

import { describe, it, expect } from "vitest";
import { priceCentsFor, priceLabelFor, MARKETPLACE_PRICE_CENTS } from "@/lib/marketplacePricing";

describe("marketplacePricing", () => {
  it("returns the configured price for known products", () => {
    expect(priceCentsFor("mortgage")).toBe(4900);
    expect(priceCentsFor("talent")).toBe(5900);
    expect(priceCentsFor("supply")).toBe(3900);
  });

  it("falls back to $49 for unknown or null products", () => {
    expect(priceCentsFor(null)).toBe(4900);
    expect(priceCentsFor(undefined)).toBe(4900);
    expect(priceCentsFor("nonexistent_product")).toBe(4900);
  });

  it("formats the price label as a whole-dollar amount", () => {
    expect(priceLabelFor("talent")).toBe("$59");
    expect(priceLabelFor("supply")).toBe("$39");
    expect(priceLabelFor(null)).toBe("$49");
  });

  it("never returns a negative or zero price", () => {
    Object.keys(MARKETPLACE_PRICE_CENTS).forEach((k) => {
      expect(MARKETPLACE_PRICE_CENTS[k]).toBeGreaterThan(0);
    });
  });
});

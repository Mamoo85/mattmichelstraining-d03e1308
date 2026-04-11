import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi, describe, it, expect, beforeEach } from "vitest";
import ContractorTerritory from "./ContractorTerritory";

// Mock Supabase
const mockInvoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: mockInvoke } },
}));

// Mock toast
vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: vi.fn() }),
}));

// Mock SEOHead (avoids helmet issues in tests)
vi.mock("@/components/layout/SEOHead", () => ({
  default: ({ title }: { title: string }) => <title>{title}</title>,
}));

function renderSlug(slug: string) {
  return render(
    <MemoryRouter initialEntries={[`/contractors/${slug}`]}>
      <Routes>
        <Route path="/contractors/:slug" element={<ContractorTerritory />} />
      </Routes>
    </MemoryRouter>
  );
}

describe("ContractorTerritory", () => {
  beforeEach(() => {
    mockInvoke.mockReset();
  });

  it("renders 404 for unknown slug", () => {
    renderSlug("fake-territory-xyz");
    expect(screen.getByText(/territory not found/i)).toBeInTheDocument();
  });

  it.each([
    "hvac-detroit", "hvac-warren", "hvac-sterling-heights", "hvac-dearborn", "hvac-livonia",
    "plumbing-detroit", "plumbing-sterling-heights", "plumbing-dearborn", "plumbing-troy", "plumbing-livonia",
    "electrician-detroit", "electrician-dearborn", "electrician-warren", "electrician-troy", "electrician-livonia",
    "roofing-detroit", "roofing-warren", "roofing-troy", "roofing-southfield", "roofing-livonia",
  ])("renders page for %s", (slug) => {
    renderSlug(slug);
    expect(screen.getByRole("button", { name: /get my free quote/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/your name/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/phone number/i)).toBeInTheDocument();
  });

  it("submits form and shows thank-you screen on success", async () => {
    mockInvoke.mockResolvedValueOnce({ error: null });
    renderSlug("hvac-detroit");

    fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: "John Smith" } });
    fireEvent.change(screen.getByPlaceholderText(/phone number/i), { target: { value: "3135551234" } });
    fireEvent.click(screen.getByRole("button", { name: /get my free quote/i }));

    await waitFor(() => {
      expect(screen.getByText(/request received/i)).toBeInTheDocument();
    });

    expect(mockInvoke).toHaveBeenCalledWith("contractor-lead-capture", {
      body: expect.objectContaining({
        site_slug: "hvac-detroit",
        name: "John Smith",
        phone: "3135551234",
        source: "seo_page",
      }),
    });
  });

  it("does not submit without name or phone", async () => {
    renderSlug("plumbing-warren");
    fireEvent.click(screen.getByRole("button", { name: /get my free quote/i }));
    await waitFor(() => {
      expect(mockInvoke).not.toHaveBeenCalled();
    });
  });

  it("calls contractor-lead-capture with correct slug for each active territory", async () => {
    const activeSlugs = ["hvac-detroit", "plumbing-detroit", "roofing-detroit"];
    for (const slug of activeSlugs) {
      mockInvoke.mockResolvedValueOnce({ error: null });
      renderSlug(slug);

      fireEvent.change(screen.getByPlaceholderText(/your name/i), { target: { value: "Test User" } });
      fireEvent.change(screen.getByPlaceholderText(/phone number/i), { target: { value: "3135550000" } });
      fireEvent.click(screen.getByRole("button", { name: /get my free quote/i }));

      await waitFor(() => {
        expect(mockInvoke).toHaveBeenCalledWith("contractor-lead-capture", {
          body: expect.objectContaining({ site_slug: slug }),
        });
      });
    }
  });
});

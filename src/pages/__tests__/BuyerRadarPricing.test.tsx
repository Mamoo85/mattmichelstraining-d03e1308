import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import {
  createSupabaseMock,
  mockInvoke,
  setupNoSessionMocks,
} from "@/test/mocks/supabase";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: createSupabaseMock(),
}));

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

import BuyerRadarPricing from "../BuyerRadarPricing";

const renderPage = () =>
  render(
    <MemoryRouter>
      <BuyerRadarPricing />
    </MemoryRouter>,
  );

describe("BuyerRadarPricing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNoSessionMocks();
  });

  it("renders all three tier columns + Custom", () => {
    renderPage();
    expect(screen.getByText("Core")).toBeInTheDocument();
    expect(screen.getByText("Pro")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
    expect(screen.getByText(/\$399/)).toBeInTheDocument();
    expect(screen.getByText(/\$599/)).toBeInTheDocument();
    expect(screen.getByText(/\$799/)).toBeInTheDocument();
  });

  it("requires email before checkout", async () => {
    const { toast } = await import("sonner");
    renderPage();
    const startBtns = screen.getAllByRole("button", { name: /Start Core|Start Pro|Start Enterprise/i });
    fireEvent.click(startBtns[0]);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
    expect(mockInvoke).not.toHaveBeenCalled();
  });

  it("invokes create-buyer-radar-checkout with the right tier", async () => {
    mockInvoke.mockResolvedValue({ data: { url: "https://stripe/test" }, error: null });
    renderPage();
    fireEvent.change(screen.getByPlaceholderText(/Work email/i), {
      target: { value: "buyer@acme.com" },
    });
    const proBtn = screen.getByRole("button", { name: /Start Pro/i });
    fireEvent.click(proBtn);
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "create-buyer-radar-checkout",
        expect.objectContaining({
          body: expect.objectContaining({ email: "buyer@acme.com", tier: "pro" }),
        }),
      );
    });
  });

  it("validates custom plan form (company + email required)", async () => {
    const { toast } = await import("sonner");
    renderPage();
    const submitBtn = screen.getByRole("button", { name: /Request custom plan/i });
    fireEvent.click(submitBtn);
    await waitFor(() => expect(toast.error).toHaveBeenCalled());
  });

  it("submits custom request to request-buyer-radar-custom", async () => {
    mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
    renderPage();
    const companyInputs = screen.getAllByPlaceholderText(/Company/i);
    const emailInputs = screen.getAllByPlaceholderText(/email/i);
    // Find the custom-form fields (last occurrences are inside the custom card)
    fireEvent.change(companyInputs[companyInputs.length - 1], {
      target: { value: "Ameristeel" },
    });
    fireEvent.change(emailInputs[emailInputs.length - 1], {
      target: { value: "ops@ameristeel.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /Request custom plan/i }));
    await waitFor(() => {
      expect(mockInvoke).toHaveBeenCalledWith(
        "request-buyer-radar-custom",
        expect.objectContaining({
          body: expect.objectContaining({
            company_name: "Ameristeel",
            email: "ops@ameristeel.com",
          }),
        }),
      );
    });
  });
});

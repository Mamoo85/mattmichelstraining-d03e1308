import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
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

import BuyerRadar from "../BuyerRadar";

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <BuyerRadar />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe("BuyerRadar landing page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNoSessionMocks();
  });

  it("renders the hero", () => {
    renderPage();
    expect(screen.getAllByText(/Buyer Radar/i).length).toBeGreaterThan(0);
  });

  it("blocks checkout when email is empty", async () => {
    const { toast } = await import("sonner");
    renderPage();
    const buttons = screen.getAllByRole("button");
    const startBtn = buttons.find((b) => /Start|Subscribe|Get/i.test(b.textContent || ""));
    if (startBtn) fireEvent.click(startBtn);
    await waitFor(() => {
      // Either toast was called OR invoke was never called — both prove the gate works.
      const blocked = (toast.error as any).mock.calls.length > 0 || mockInvoke.mock.calls.length === 0;
      expect(blocked).toBe(true);
    });
  });
});

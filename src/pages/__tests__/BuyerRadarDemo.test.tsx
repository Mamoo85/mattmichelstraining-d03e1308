import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { HelmetProvider } from "react-helmet-async";
import { createSupabaseMock, setupNoSessionMocks } from "@/test/mocks/supabase";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: createSupabaseMock(),
}));

// Force non-admin so the live-data toggle is hidden and sample data is used
vi.mock("@/hooks/useIsAdmin", () => ({
  useIsAdmin: () => ({ isAdmin: false, isLoading: false }),
}));

import BuyerRadarDemo from "../BuyerRadarDemo";

const renderPage = () =>
  render(
    <HelmetProvider>
      <MemoryRouter>
        <BuyerRadarDemo />
      </MemoryRouter>
    </HelmetProvider>,
  );

describe("BuyerRadarDemo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupNoSessionMocks();
  });

  it("renders step 1 (Targeting) heading on initial load", () => {
    renderPage();
    const h1 = screen.getByRole("heading", { level: 1 });
    expect(h1.textContent).toMatch(/Step\s*1\.\s*Targeting/i);
  });

  it("advances through all 5 steps via Next", () => {
    renderPage();
    const next = () => fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    next();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Step\s*2/i);
    next(); next(); next();
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Step\s*5/i);
  });

  it("Back button navigates to previous step", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Step\s*2/i);
    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    expect(screen.getByRole("heading", { level: 1 }).textContent).toMatch(/Step\s*1/i);
  });

  it("hides the live-data toggle for non-admins", () => {
    renderPage();
    expect(screen.queryByText(/Use live data/i)).not.toBeInTheDocument();
  });
});

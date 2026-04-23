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

  it("renders step 1 (Targeting) on initial load", () => {
    renderPage();
    expect(screen.getByText(/Targeting/i)).toBeInTheDocument();
    expect(screen.getByText(/Step 1 of 5/i)).toBeInTheDocument();
  });

  it("advances through all 5 steps via Next", () => {
    renderPage();
    const next = () => fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    next(); // 2
    expect(screen.getByText(/Step 2 of 5/i)).toBeInTheDocument();
    next(); next(); next(); // 5
    expect(screen.getByText(/Step 5 of 5/i)).toBeInTheDocument();
  });

  it("Back button navigates to previous step", () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    expect(screen.getByText(/Step 2 of 5/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Back/i }));
    expect(screen.getByText(/Step 1 of 5/i)).toBeInTheDocument();
  });

  it("hides the live-data toggle for non-admins", () => {
    renderPage();
    expect(screen.queryByText(/Use live data/i)).not.toBeInTheDocument();
  });
});

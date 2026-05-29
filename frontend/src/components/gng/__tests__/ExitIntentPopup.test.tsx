import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ExitIntentPopup from "../ExitIntentPopup";

// Mock podSupabase
vi.mock("@/integrations/supabase/podClient", () => ({
  podSupabase: {
    from: () => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }),
  },
}));

function triggerExitIntent() {
  const event = new MouseEvent("mouseleave", { clientY: 0, bubbles: true });
  document.dispatchEvent(event);
}

beforeEach(() => {
  sessionStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("ExitIntentPopup", () => {
  it("is not visible on initial render", () => {
    render(<ExitIntentPopup />);
    expect(screen.queryByText("Wait — get 10% off!")).toBeNull();
  });

  it("does not show immediately on mouseleave (before 3s delay)", () => {
    render(<ExitIntentPopup />);
    // Advance only 1s — listener not registered yet
    act(() => { vi.advanceTimersByTime(1000); });
    triggerExitIntent();
    expect(screen.queryByText("Wait — get 10% off!")).toBeNull();
  });

  it("shows after mouseleave once the 3s delay has elapsed", () => {
    render(<ExitIntentPopup />);
    act(() => { vi.advanceTimersByTime(3500); });
    act(() => { triggerExitIntent(); });
    expect(screen.queryByText("Wait — get 10% off!")).toBeTruthy();
  });

  it("does NOT show if already shown this session (sessionStorage guard)", () => {
    sessionStorage.setItem("gng_exit_shown", "1");
    render(<ExitIntentPopup />);
    act(() => { vi.advanceTimersByTime(3500); });
    act(() => { triggerExitIntent(); });
    expect(screen.queryByText("Wait — get 10% off!")).toBeNull();
  });

  it("renders close button and hides popup on click", () => {
    render(<ExitIntentPopup />);
    act(() => { vi.advanceTimersByTime(3500); });
    act(() => { triggerExitIntent(); });

    expect(screen.queryByText("Wait — get 10% off!")).toBeTruthy();

    const closeBtn = screen.getByLabelText("Close");
    fireEvent.click(closeBtn);
    expect(screen.queryByText("Wait — get 10% off!")).toBeNull();
  });
});

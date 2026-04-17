import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";

// Must use vi.hoisted so mocks are in place before module imports are hoisted
const mockGetSession = vi.hoisted(() => vi.fn());
const mockGetUser = vi.hoisted(() => vi.fn());
const mockOnAuthStateChange = vi.hoisted(() => vi.fn());
const mockSignOut = vi.hoisted(() => vi.fn());
const mockFunctionsInvoke = vi.hoisted(() => vi.fn());
const mockQueryClientClear = vi.hoisted(() => vi.fn());
const mockRemoveItem = vi.hoisted(() => vi.fn());

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
    },
    functions: { invoke: mockFunctionsInvoke },
  },
}));

vi.mock("@/lib/browserStorage", () => ({
  safeLocalStorage: { removeItem: mockRemoveItem },
}));

vi.mock("@/lib/queryClient", () => ({
  queryClient: { clear: mockQueryClientClear },
}));

import {
  getTierByProductId,
  TIERS,
  TIER_DISCOUNTS,
  AuthProvider,
  useAuth,
} from "../useAuth";

// ─── Pure function tests ──────────────────────────────────────────────────────

describe("getTierByProductId", () => {
  it("maps foundation product ID", () => {
    expect(getTierByProductId("prod_UBI78IQsBpyfNw")).toBe("foundation");
  });

  it("maps guided product ID", () => {
    expect(getTierByProductId("prod_UEfNKQVnbRcu1F")).toBe("guided");
  });

  it("maps pro product ID", () => {
    expect(getTierByProductId("prod_UBI7Wdb3liTxiF")).toBe("pro");
  });

  it("maps elite product ID", () => {
    expect(getTierByProductId("prod_UBI8SV9Fa6CibX")).toBe("elite");
  });

  it("returns null for an unknown product ID", () => {
    expect(getTierByProductId("prod_unknown_xyz")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(getTierByProductId(null)).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(getTierByProductId("")).toBeNull();
  });
});

describe("TIERS constant", () => {
  it("contains exactly the four expected tier keys", () => {
    expect(Object.keys(TIERS).sort()).toEqual(
      ["elite", "foundation", "guided", "pro"]
    );
  });

  it("every tier has a non-empty product_id and price_id", () => {
    for (const tier of Object.values(TIERS)) {
      expect(tier.product_id).toBeTruthy();
      expect(tier.price_id).toBeTruthy();
    }
  });

  it("prices increase with tier level", () => {
    expect(TIERS.foundation.priceNum).toBeLessThan(TIERS.guided.priceNum);
    expect(TIERS.guided.priceNum).toBeLessThan(TIERS.pro.priceNum);
    expect(TIERS.pro.priceNum).toBeLessThan(TIERS.elite.priceNum);
  });
});

describe("TIER_DISCOUNTS constant", () => {
  it("all discount values are positive numbers", () => {
    for (const discount of Object.values(TIER_DISCOUNTS)) {
      expect(discount).toBeGreaterThan(0);
    }
  });

  it("elite discount is greater than foundation discount", () => {
    expect(TIER_DISCOUNTS.elite).toBeGreaterThan(TIER_DISCOUNTS.foundation);
  });
});

// ─── AuthProvider / useAuth hook tests ───────────────────────────────────────

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <AuthProvider>{children}</AuthProvider>
);

function defaultMocks() {
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  mockSignOut.mockResolvedValue({});
  mockFunctionsInvoke.mockResolvedValue({ data: null, error: null });
}

describe("useAuth — no session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultMocks();
  });

  it("starts with loading=true", () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.loading).toBe(true);
  });

  it("resolves loading=false after session hydration", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("exposes user=null and subscribed=false when no session", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.user).toBeNull();
    expect(result.current.subscribed).toBe(false);
    expect(result.current.subscriptionTier).toBeNull();
  });
});

describe("useAuth — with active session", () => {
  const mockSession = {
    access_token: "tok_abc",
    user: { id: "user-1", email: "matt@example.com" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({ data: { session: mockSession } });
    mockGetUser.mockResolvedValue({ data: { user: mockSession.user }, error: null });
    mockOnAuthStateChange.mockReturnValue({
      data: { subscription: { unsubscribe: vi.fn() } },
    });
    mockSignOut.mockResolvedValue({});
    mockFunctionsInvoke.mockResolvedValue({
      data: { subscribed: true, product_id: "prod_UBI78IQsBpyfNw" },
      error: null,
    });
  });

  it("exposes the user from the session", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.user).not.toBeNull());
    expect(result.current.user?.id).toBe("user-1");
  });

  it("sets subscribed=true when check-subscription returns subscribed", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.subscribed).toBe(true));
  });

  it("derives subscriptionTier from the product_id", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.subscriptionTier).toBe("foundation"));
  });

  it("clears subscribed state when check-subscription throws", async () => {
    mockFunctionsInvoke.mockRejectedValue(new Error("network error"));
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.subscribed).toBe(false);
    expect(result.current.subscriptionTier).toBeNull();
  });

  it("clears subscribed state when check-subscription returns an error", async () => {
    mockFunctionsInvoke.mockResolvedValue({
      data: null,
      error: new Error("unauthorized"),
    });
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.subscribed).toBe(false);
  });
});

describe("useAuth — signOut", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    defaultMocks();
  });

  it("calls queryClient.clear() on sign out", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockQueryClientClear).toHaveBeenCalled();
  });

  it("removes both local storage keys on sign out", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockRemoveItem).toHaveBeenCalledWith("m2-query-cache");
    expect(mockRemoveItem).toHaveBeenCalledWith("m2_offline_queue");
  });

  it("calls supabase.auth.signOut with scope:local", async () => {
    const { result } = renderHook(() => useAuth(), { wrapper });
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });
});

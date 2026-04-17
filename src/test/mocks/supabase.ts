/**
 * Reusable Supabase mock factory for Vitest tests.
 *
 * Usage:
 *   import { createSupabaseMock, mockInvoke, mockGetSession } from "@/test/mocks/supabase";
 *   vi.mock("@/integrations/supabase/client", () => ({ supabase: createSupabaseMock() }));
 */
import { vi } from "vitest";

export const mockGetSession = vi.fn();
export const mockGetUser = vi.fn();
export const mockOnAuthStateChange = vi.fn();
export const mockSignOut = vi.fn();
export const mockInvoke = vi.fn();

/** Returns a fresh mock that mirrors the supabase client shape used across the app. */
export function createSupabaseMock() {
  return {
    auth: {
      getSession: mockGetSession,
      getUser: mockGetUser,
      onAuthStateChange: mockOnAuthStateChange,
      signOut: mockSignOut,
    },
    functions: {
      invoke: mockInvoke,
    },
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      neq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      lte: vi.fn().mockReturnThis(),
      lt: vi.fn().mockReturnThis(),
      gt: vi.fn().mockReturnThis(),
      not: vi.fn().mockReturnThis(),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
  };
}

/** Default no-op auth state: no session, loading resolves immediately. */
export function setupNoSessionMocks() {
  mockGetSession.mockResolvedValue({ data: { session: null } });
  mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  mockSignOut.mockResolvedValue({});
}

/** Auth state mock with an active session and subscribed=true. */
export function setupSubscribedSessionMocks(
  productId = "prod_UBI78IQsBpyfNw",
  overrides: Record<string, unknown> = {},
) {
  const session = {
    access_token: "mock-access-token",
    user: { id: "user-abc", email: "test@example.com", ...overrides },
  };
  mockGetSession.mockResolvedValue({ data: { session } });
  mockGetUser.mockResolvedValue({ data: { user: session.user }, error: null });
  mockOnAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
  mockSignOut.mockResolvedValue({});
  mockInvoke.mockResolvedValue({
    data: { subscribed: true, product_id: productId },
    error: null,
  });
  return session;
}

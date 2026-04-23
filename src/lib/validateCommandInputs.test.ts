/**
 * End-to-end validation test for AdminCommandBar's pre-flight guards.
 *
 * Simulates a representative failing admin command (oversized prompt + bad
 * recipients + over-cap queue) and asserts:
 *   1. The validator REJECTS before any network call (no 5xx from edge fn).
 *   2. Every rejection carries an actionable, user-readable `reason` string
 *      that the admin UI can surface verbatim.
 *   3. A clean payload still passes — guard isn't over-broad.
 */
import { describe, it, expect } from "vitest";
import {
  validatePrompt,
  validateRecipient,
  validateRegenerateParams,
  validateQueuePayload,
  type ValidationResult,
} from "./validateCommandInputs";

/** Narrow a ValidationResult to its failure branch + assert actionable reason. */
function expectFailure(
  result: ValidationResult,
  contains?: string,
): asserts result is { ok: false; reason: string } {
  if (result.ok !== false) {
    throw new Error("expected failure but validator returned ok");
  }
  expect(typeof result.reason).toBe("string");
  expect(result.reason.length).toBeGreaterThan(0);
  if (contains) {
    expect(result.reason.toLowerCase()).toContain(contains.toLowerCase());
  }
}

describe("AdminCommandBar pre-flight — failing command e2e", () => {
  describe("prompt guards", () => {
    it("rejects too-short prompts with actionable reason", () => {
      expectFailure(validatePrompt("hi"), "too short");
    });

    it("rejects oversize prompts (>1000 chars) with actionable reason", () => {
      const huge = "find leads ".repeat(120); // ~1320 chars
      expectFailure(validatePrompt(huge), "too long");
    });

    it("rejects destructive SQL keywords with actionable reason", () => {
      expectFailure(
        validatePrompt("please DROP TABLE contractor_clients now"),
        "destructive",
      );
    });

    it("rejects 'find N' counts above 100", () => {
      const result = validatePrompt("find 500 HVAC contractors in Detroit");
      expectFailure(result, "exceeds max");
      expect(result.reason).toContain("100");
    });

    it("accepts a clean, in-bounds prompt", () => {
      expect(validatePrompt("find 25 plumbers in Warren MI")).toEqual({ ok: true });
    });
  });

  describe("recipient guards", () => {
    it("rejects when both email and phone are missing", () => {
      expectFailure(validateRecipient({}), "email or a phone");
    });

    it("rejects malformed email with the bad value in the reason", () => {
      const result = validateRecipient({ to_email: "not-an-email" });
      expectFailure(result, "invalid email");
      expect(result.reason).toContain("not-an-email");
    });

    it("rejects malformed phone", () => {
      expectFailure(validateRecipient({ to_phone: "abc123" }), "invalid phone");
    });

    it("accepts E.164 phone with formatting", () => {
      expect(validateRecipient({ to_phone: "+1 (313) 992-1219" })).toEqual({ ok: true });
    });
  });

  describe("regenerate param guards", () => {
    it("rejects unknown product", () => {
      expectFailure(
        validateRegenerateParams({ product: "made_up_product" }),
        "unknown product",
      );
    });

    it("rejects unknown tone with allowed list in the reason", () => {
      const result = validateRegenerateParams({ tone: "sarcastic" });
      expectFailure(result, "tone");
      expect(result.reason).toContain("direct");
    });

    it("rejects unknown channel", () => {
      expectFailure(
        validateRegenerateParams({ channel: "carrier_pigeon" }),
        "email or sms",
      );
    });
  });

  describe("queue payload guards — representative failing command", () => {
    it("rejects empty queue with actionable reason", () => {
      expectFailure(validateQueuePayload([]), "nothing to queue");
    });

    it("rejects queue over the 50-draft cap", () => {
      const overLimit = Array.from({ length: 51 }, (_, i) => ({
        to_email: `user${i}@example.com`,
        body: "hi",
      }));
      const result = validateQueuePayload(overLimit);
      expectFailure(result, "too many");
      expect(result.reason).toContain("51");
      expect(result.reason).toContain("50");
    });

    it("rejects a draft with empty body and points to the offending index", () => {
      const drafts = [
        { to_email: "ok@example.com", body: "real message" },
        { to_email: "bad@example.com", body: "   " }, // empty after trim
      ];
      const result = validateQueuePayload(drafts);
      expectFailure(result, "draft #2");
      expect(result.reason).toContain("empty body");
    });

    it("rejects a draft with bad recipient and points to the offending index", () => {
      const drafts = [
        { to_email: "totally-broken-email", body: "hello" },
      ];
      const result = validateQueuePayload(drafts);
      expectFailure(result, "draft #1");
      expect(result.reason!.toLowerCase()).toContain("invalid email");
    });

    it("accepts a clean batch", () => {
      const drafts = [
        { to_email: "lead1@example.com", subject: "Hi", body: "Quick question..." },
        { to_phone: "+13139921219", body: "Got a sec?" },
      ];
      expect(validateQueuePayload(drafts)).toEqual({ ok: true });
    });
  });

  describe("end-to-end failing command — composite scenario", () => {
    /**
     * Representative failure: admin pastes a prompt asking for 9999 leads,
     * with a malformed recipient sneaking into the queue. Pre-flight must
     * catch BOTH and return actionable reasons before any 5xx fires.
     */
    it("surfaces actionable errors for prompt + queue together", () => {
      const promptResult = validatePrompt(
        "find 9999 contractors and email them all today",
      );
      expectFailure(promptResult, "exceeds max");

      const queueResult = validateQueuePayload([
        { to_email: "real@example.com", body: "valid pitch body" },
        { to_email: "broken-email", body: "another pitch" },
      ]);
      expectFailure(queueResult, "draft #2");

      // Both errors are non-empty strings — admin UI can render them as toasts.
      const surfaced = [promptResult.reason, queueResult.reason].filter(Boolean);
      expect(surfaced).toHaveLength(2);
      surfaced.forEach((msg) => expect(msg!.length).toBeGreaterThan(10));
    });
  });
});

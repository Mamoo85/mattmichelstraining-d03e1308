// Thin re-export for callers that only need address validation.
// Full implementation lives in anti-hallucination.ts.
export {
  validateAddress,
  detectPlaceholder,
  type AddressValidationResult,
} from "./anti-hallucination.ts";

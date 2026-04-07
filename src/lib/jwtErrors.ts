const STALE_JWT_PATTERNS = [
  "session_not_found",
  "invalid claim",
  "invalid JWT",
  "JWT expired",
  "token is unverifiable",
  "unrecognized JWT kid",
] as const;

export function isStaleJWTError(message: string): boolean {
  return STALE_JWT_PATTERNS.some((p) => message.includes(p));
}

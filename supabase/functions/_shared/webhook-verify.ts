// Shared webhook signature verification helpers.
// Used by resend-bounce-webhook (Svix) and outreach-reply-handler (Twilio inbound SMS).

/**
 * Verify a Svix-signed webhook (Resend uses Svix).
 * Header format: `svix-signature: v1,base64sig v1,base64sig2`
 * Signed payload: `{svix_id}.{svix_timestamp}.{rawBody}`
 * Returns true if any signature matches the secret.
 *
 * If `secret` is empty/undefined, returns true (caller must decide whether to allow).
 */
export async function verifySvixSignature(
  rawBody: string,
  headers: Headers,
  secret: string | undefined,
): Promise<boolean> {
  if (!secret) return true; // not configured — caller logs a warning
  const svixId = headers.get("svix-id");
  const svixTs = headers.get("svix-timestamp");
  const svixSig = headers.get("svix-signature");
  if (!svixId || !svixTs || !svixSig) return false;

  // Reject if timestamp is more than 5 min skewed
  const tsNum = Number(svixTs);
  if (!Number.isFinite(tsNum) || Math.abs(Date.now() / 1000 - tsNum) > 300) {
    return false;
  }

  // Svix secret format: "whsec_xxxx" — base64-decode the part after the prefix
  const rawSecret = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  let keyBytes: Uint8Array;
  try {
    keyBytes = Uint8Array.from(atob(rawSecret), (c) => c.charCodeAt(0));
  } catch {
    return false;
  }

  const key = await crypto.subtle.importKey(
    "raw",
    keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength) as ArrayBuffer,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const toSign = `${svixId}.${svixTs}.${rawBody}`;
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(toSign));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));

  // Header may contain multiple "v1,sig" pairs space-separated
  for (const part of svixSig.split(" ")) {
    const [version, sig] = part.split(",");
    if (version === "v1" && sig === expected) return true;
  }
  return false;
}

/**
 * Verify Twilio inbound webhook signature.
 * Twilio signs: `url + sortedFormParams.concat()` with HMAC-SHA1 + base64.
 * url = full https URL of this endpoint (from request).
 *
 * If `authToken` is empty/undefined, returns true (caller decides).
 */
export async function verifyTwilioSignature(
  fullUrl: string,
  formParams: Record<string, string>,
  signatureHeader: string | null,
  authToken: string | undefined,
): Promise<boolean> {
  if (!authToken) return true;
  if (!signatureHeader) return false;

  const sortedKeys = Object.keys(formParams).sort();
  const data = sortedKeys.reduce((acc, k) => acc + k + formParams[k], fullUrl);

  const tokenBytes = new TextEncoder().encode(authToken);
  const key = await crypto.subtle.importKey(
    "raw",
    tokenBytes.buffer.slice(tokenBytes.byteOffset, tokenBytes.byteOffset + tokenBytes.byteLength) as ArrayBuffer,
    { name: "HMAC", hash: "SHA-1" },
    false,
    ["sign"],
  );
  const sigBuf = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(data));
  const expected = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  return expected === signatureHeader;
}

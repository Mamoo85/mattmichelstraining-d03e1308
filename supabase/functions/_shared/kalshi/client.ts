// Kalshi REST API client (v2).
// Auth: RSA-PSS signed request. KALSHI_API_KEY_ID + KALSHI_PRIVATE_KEY_PEM secrets required.
// Env: KALSHI_ENV=prod|demo (defaults to demo).

const ENV = Deno.env.get("KALSHI_ENV") ?? "demo";
export const KALSHI_BASE =
  ENV === "prod"
    ? "https://api.elections.kalshi.com/trade-api/v2"
    : "https://demo-api.kalshi.co/trade-api/v2";

const KEY_ID = Deno.env.get("KALSHI_API_KEY_ID") ?? "";
const PRIVATE_KEY_PEM = Deno.env.get("KALSHI_PRIVATE_KEY_PEM") ?? "";

let _cachedKey: CryptoKey | null = null;

async function getSigningKey(): Promise<CryptoKey> {
  if (_cachedKey) return _cachedKey;
  if (!PRIVATE_KEY_PEM) throw new Error("KALSHI_PRIVATE_KEY_PEM not configured");
  const pemContents = PRIVATE_KEY_PEM
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\s+/g, "");
  const binary = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  _cachedKey = await crypto.subtle.importKey(
    "pkcs8",
    binary.buffer,
    { name: "RSA-PSS", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return _cachedKey;
}

async function sign(method: string, path: string, timestamp: string): Promise<string> {
  const key = await getSigningKey();
  const msg = new TextEncoder().encode(`${timestamp}${method}${path}`);
  const sig = await crypto.subtle.sign(
    { name: "RSA-PSS", saltLength: 32 },
    key,
    msg,
  );
  return btoa(String.fromCharCode(...new Uint8Array(sig)));
}

export interface KalshiRequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined>;
}

export async function kalshiRequest<T = unknown>(
  path: string,
  opts: KalshiRequestOptions = {},
): Promise<T> {
  if (!KEY_ID) throw new Error("KALSHI_API_KEY_ID not configured");
  const method = opts.method ?? "GET";
  const ts = Date.now().toString();
  // Kalshi signs only the URL path (no query string, no host).
  const signaturePath = `/trade-api/v2${path}`;
  const signature = await sign(method, signaturePath, ts);

  let url = `${KALSHI_BASE}${path}`;
  if (opts.query) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(opts.query)) {
      if (v !== undefined && v !== null) params.set(k, String(v));
    }
    const qs = params.toString();
    if (qs) url += `?${qs}`;
  }

  const res = await fetch(url, {
    method,
    headers: {
      "KALSHI-ACCESS-KEY": KEY_ID,
      "KALSHI-ACCESS-SIGNATURE": signature,
      "KALSHI-ACCESS-TIMESTAMP": ts,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Kalshi ${method} ${path} ${res.status}: ${text.slice(0, 500)}`);
  }
  return (await res.json()) as T;
}

// --- Typed endpoint helpers ---

export interface KalshiMarket {
  ticker: string;
  event_ticker: string;
  status: string;
  yes_bid: number; // cents
  yes_ask: number;
  no_bid: number;
  no_ask: number;
  last_price: number;
  volume: number;
  open_interest: number;
  close_time: string;
  title?: string;
  subtitle?: string;
}

export function getMarket(ticker: string) {
  return kalshiRequest<{ market: KalshiMarket }>(`/markets/${ticker}`);
}

export function listMarkets(query: { status?: string; event_ticker?: string; series_ticker?: string; limit?: number; cursor?: string } = {}) {
  return kalshiRequest<{ markets: KalshiMarket[]; cursor?: string }>(`/markets`, { query });
}

export function getBalance() {
  return kalshiRequest<{ balance: number; payout: number }>(`/portfolio/balance`);
}

export function getPositions(query: { limit?: number; cursor?: string; ticker?: string; event_ticker?: string } = {}) {
  return kalshiRequest<{ market_positions: unknown[]; event_positions: unknown[]; cursor?: string }>(`/portfolio/positions`, { query });
}

export interface PlaceOrderInput {
  ticker: string;
  side: "yes" | "no";
  action: "buy" | "sell";
  type: "limit" | "market";
  count: number;
  yes_price?: number; // cents, required for yes limit
  no_price?: number; // cents, required for no limit
  client_order_id: string;
}

export function placeOrder(input: PlaceOrderInput) {
  return kalshiRequest<{ order: { order_id: string; status: string } }>(`/portfolio/orders`, {
    method: "POST",
    body: input,
  });
}

export function cancelOrder(orderId: string) {
  return kalshiRequest<{ order: unknown }>(`/portfolio/orders/${orderId}`, { method: "DELETE" });
}

export function isConfigured(): boolean {
  return Boolean(KEY_ID && PRIVATE_KEY_PEM);
}

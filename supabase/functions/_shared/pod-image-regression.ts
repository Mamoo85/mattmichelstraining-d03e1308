// Pre-publish image regression gate: enforces full-bleed + exact spec dims.
// Throws RegressionError if image fails. All POD publish entry points should call this.
import { Image, decode } from "https://deno.land/x/imagescript@1.2.17/mod.ts";
import { getPrintSpec, type PrintSpec } from "./pod-print-spec.ts";

export class RegressionError extends Error {
  reason: string;
  meta: Record<string, unknown>;
  constructor(reason: string, meta: Record<string, unknown> = {}) {
    super(`pod_regression_${reason}: ${JSON.stringify(meta)}`);
    this.reason = reason;
    this.meta = meta;
  }
}

export interface RegressionResult {
  pass: boolean;
  reason?: string;
  width: number;
  height: number;
  expected_width: number;
  expected_height: number;
  edge_white_pct?: number;
}

function pctWhiteAlphaEdge(img: Image): { whitePct: number; alphaPct: number } {
  const w = img.width, h = img.height;
  const strip = Math.max(4, Math.floor(Math.min(w, h) * 0.01)); // ~1% edge
  let edgeTotal = 0, whiteCount = 0, transCount = 0;
  const isNearWhite = (r: number, g: number, b: number) => r > 245 && g > 245 && b > 245;

  const sample = (x: number, y: number) => {
    const px = img.getPixelAt(x + 1, y + 1); // imagescript 1-indexed; clamp inside
    const r = (px >>> 24) & 0xff;
    const g = (px >>> 16) & 0xff;
    const b = (px >>> 8) & 0xff;
    const a = px & 0xff;
    edgeTotal++;
    if (a < 16) transCount++;
    else if (isNearWhite(r, g, b)) whiteCount++;
  };

  // Step coarsely (every 8px) for speed
  const step = 8;
  for (let x = 0; x < w; x += step) {
    for (let y = 0; y < strip; y += step) sample(x, y);
    for (let y = h - strip; y < h; y += step) sample(x, Math.max(0, y));
  }
  for (let y = 0; y < h; y += step) {
    for (let x = 0; x < strip; x += step) sample(x, y);
    for (let x = w - strip; x < w; x += step) sample(Math.max(0, x), y);
  }
  return {
    whitePct: edgeTotal ? whiteCount / edgeTotal : 0,
    alphaPct: edgeTotal ? transCount / edgeTotal : 0,
  };
}

/**
 * Validate an image buffer against the canonical print spec for the product type.
 * @param buf raw image bytes (PNG/JPEG)
 * @param productType key into PRINT_SPECS
 * @returns RegressionResult (also throws RegressionError on hard fail)
 */
export async function assertFullBleedAndSpec(
  buf: Uint8Array,
  productType: string,
): Promise<RegressionResult> {
  const spec = getPrintSpec(productType);
  if (!spec) throw new RegressionError("unknown_product_type", { productType });

  let img: Image;
  try {
    img = await decode(buf) as Image;
  } catch (e) {
    throw new RegressionError("decode_failed", { err: (e as Error).message });
  }

  const w = img.width, h = img.height;
  const out: RegressionResult = {
    pass: false, width: w, height: h,
    expected_width: spec.width, expected_height: spec.height,
  };

  // 1) Exact dimensions (±0.5% tolerance)
  const wTol = Math.max(2, Math.round(spec.width * 0.005));
  const hTol = Math.max(2, Math.round(spec.height * 0.005));
  if (Math.abs(w - spec.width) > wTol || Math.abs(h - spec.height) > hTol) {
    out.reason = "wrong_dims";
    throw new RegressionError("wrong_dims", { w, h, expected: [spec.width, spec.height] });
  }

  // 2) Edge sampling
  const { whitePct, alphaPct } = pctWhiteAlphaEdge(img);
  out.edge_white_pct = Number(whitePct.toFixed(3));

  if (spec.bgMode === "opaque_fullbleed") {
    // Edges must NOT be mostly white (>5% would mean blank borders, not full-bleed)
    if (whitePct > 0.05) {
      out.reason = "not_full_bleed";
      throw new RegressionError("not_full_bleed", { edge_white_pct: whitePct });
    }
    // Edges must be opaque
    if (alphaPct > 0.02) {
      out.reason = "edges_transparent";
      throw new RegressionError("edges_transparent", { edge_alpha_pct: alphaPct });
    }
  } else if (spec.bgMode === "transparent" || spec.bgMode === "die_cut") {
    // Edges should be mostly transparent (graphic isolated on garment / sticker cut)
    if (alphaPct < 0.6) {
      out.reason = "background_not_transparent";
      throw new RegressionError("background_not_transparent", { edge_alpha_pct: alphaPct });
    }
  } else if (spec.bgMode === "white_centered") {
    // Mug: edges should be near-white
    if (whitePct < 0.6) {
      out.reason = "mug_bg_not_white";
      throw new RegressionError("mug_bg_not_white", { edge_white_pct: whitePct });
    }
  }

  out.pass = true;
  return out;
}

/**
 * Convenience: run the gate and log the outcome. Never throws — returns {pass:false} on failure.
 * Use this from callers that should record the attempt to pod_image_regression_log.
 */
export async function validateAndLog(
  sb: { from: (t: string) => any },
  buf: Uint8Array,
  productType: string,
  ctx: { listing_id?: string | null; printify_id?: string | null; caller: string },
): Promise<RegressionResult> {
  let result: RegressionResult;
  let pass = false, reason: string | null = null;
  try {
    result = await assertFullBleedAndSpec(buf, productType);
    pass = result.pass;
  } catch (e) {
    const err = e as RegressionError;
    reason = err.reason ?? "unknown";
    const m: any = err.meta ?? {};
    result = {
      pass: false, reason,
      width: Number(m.w ?? m.width ?? 0),
      height: Number(m.h ?? m.height ?? 0),
      expected_width: Array.isArray(m.expected) ? m.expected[0] : 0,
      expected_height: Array.isArray(m.expected) ? m.expected[1] : 0,
      edge_white_pct: m.edge_white_pct ?? null,
    };
  }

  try {
    await sb.from("pod_image_regression_log").insert({
      listing_id: ctx.listing_id ?? null,
      printify_id: ctx.printify_id ?? null,
      product_type: productType,
      pass,
      reason,
      width: result.width,
      height: result.height,
      expected_width: result.expected_width,
      expected_height: result.expected_height,
      edge_white_pct: result.edge_white_pct ?? null,
      caller: ctx.caller,
    });
  } catch (_) { /* ignore log errors */ }

  return result;
}

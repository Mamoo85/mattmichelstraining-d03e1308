// Canonical per-product print-area spec for POD pipeline.
import { Image, decode } from "https://deno.land/x/imagescript@1.2.17/mod.ts";
// `width` x `height` = required artwork pixel dimensions for primary placement.
// `bgMode`:
//   - "transparent"     → apparel-style isolated graphic on garment fabric (alpha=0)
//   - "opaque_fullbleed"→ design fills the entire print area edge-to-edge with an OPAQUE background
//   - "white_centered"  → solid white #FFFFFF, artwork confined to center 30% (mug cylinder wrap)
//   - "die_cut"         → transparent, used for stickers/decals/magnets (cut to shape)
//
// `aspect` is informational; clients must use exact width/height when generating.

export type BgMode = "transparent" | "opaque_fullbleed" | "white_centered" | "die_cut";

export interface PrintSpec {
  width: number;
  height: number;
  bgMode: BgMode;
  position: string; // "front" | "back" | "default"
}

// Dimensions sourced from Printify blueprint print-area defaults.
// Where exact dims vary by blueprint, we use the most common provider's primary placement.
export const PRINT_SPECS: Record<string, PrintSpec> = {
  // --- Apparel (transparent isolated graphic on fabric) ---
  tshirt:        { width: 4500, height: 5400, bgMode: "transparent", position: "front" },
  long_sleeve:   { width: 4500, height: 5400, bgMode: "transparent", position: "front" },
  tank_top:      { width: 4500, height: 5400, bgMode: "transparent", position: "front" },
  hoodie:        { width: 4500, height: 5400, bgMode: "transparent", position: "front" },
  sweatshirt:    { width: 4500, height: 5400, bgMode: "transparent", position: "front" },
  youth_hoodie:  { width: 4000, height: 4800, bgMode: "transparent", position: "front" },
  kids_tshirt:   { width: 4000, height: 4800, bgMode: "transparent", position: "front" },
  toddler_tee:   { width: 3600, height: 4200, bgMode: "transparent", position: "front" },
  baby_onesie:   { width: 3600, height: 4200, bgMode: "transparent", position: "front" },
  apron:         { width: 3300, height: 3900, bgMode: "transparent", position: "front" },
  hat:           { width: 2400, height: 2400, bgMode: "transparent", position: "front" },
  scarf:         { width: 4800, height: 1800, bgMode: "transparent", position: "front" },

  // --- Mugs / drinkware (white bg, art confined to center 30%) ---
  mug:           { width: 2700, height: 1200, bgMode: "white_centered", position: "front" },
  latte_mug:     { width: 2700, height: 1200, bgMode: "white_centered", position: "front" },
  travel_mug:    { width: 2730, height: 1200, bgMode: "white_centered", position: "front" },
  tumbler_10:    { width: 2730, height: 1200, bgMode: "white_centered", position: "front" },
  tumbler_20:    { width: 2730, height: 1200, bgMode: "white_centered", position: "front" },

  // --- Full-bleed opaque (design fills edge to edge with bg color) ---
  tote:          { width: 4200, height: 4200, bgMode: "opaque_fullbleed", position: "front" },
  pouch:         { width: 3200, height: 2400, bgMode: "opaque_fullbleed", position: "front" },
  fanny_pack:    { width: 3000, height: 1500, bgMode: "opaque_fullbleed", position: "front" },
  duffel:        { width: 4500, height: 2400, bgMode: "opaque_fullbleed", position: "front" },
  weekender:     { width: 5400, height: 2700, bgMode: "opaque_fullbleed", position: "front" },
  backpack:      { width: 3600, height: 4200, bgMode: "opaque_fullbleed", position: "front" },
  laptop_sleeve: { width: 4200, height: 3000, bgMode: "opaque_fullbleed", position: "front" },
  pillow:        { width: 4500, height: 4500, bgMode: "opaque_fullbleed", position: "front" },
  pillow_case:   { width: 5400, height: 3000, bgMode: "opaque_fullbleed", position: "front" },
  blanket:       { width: 6000, height: 7500, bgMode: "opaque_fullbleed", position: "front" },
  beach_towel:   { width: 4500, height: 7500, bgMode: "opaque_fullbleed", position: "front" },
  bath_mat:      { width: 4500, height: 3000, bgMode: "opaque_fullbleed", position: "front" },
  shower_curtain:{ width: 6000, height: 6000, bgMode: "opaque_fullbleed", position: "front" },
  tapestry:      { width: 6000, height: 6000, bgMode: "opaque_fullbleed", position: "front" },
  bandana:       { width: 3150, height: 1691, bgMode: "opaque_fullbleed", position: "front" },
  socks:         { width: 2700, height: 3600, bgMode: "opaque_fullbleed", position: "front" },
  mouse_pad:     { width: 3000, height: 2400, bgMode: "opaque_fullbleed", position: "front" },
  coaster:       { width: 1200, height: 1200, bgMode: "opaque_fullbleed", position: "front" },
  jigsaw:        { width: 5400, height: 4200, bgMode: "opaque_fullbleed", position: "front" },
  postcard:      { width: 1875, height: 1275, bgMode: "opaque_fullbleed", position: "front" },
  poster:        { width: 3600, height: 5400, bgMode: "opaque_fullbleed", position: "front" },
  wall_clock:    { width: 3000, height: 3000, bgMode: "opaque_fullbleed", position: "front" },
  journal:       { width: 2700, height: 3300, bgMode: "opaque_fullbleed", position: "front" },
  notebook:      { width: 2700, height: 3300, bgMode: "opaque_fullbleed", position: "front" },
  can_holder:    { width: 1200, height: 1200, bgMode: "opaque_fullbleed", position: "front" },
  phone_case_slim:{ width: 1242, height: 2436, bgMode: "opaque_fullbleed", position: "front" },
  phone_case_tough:{ width: 1242, height: 2436, bgMode: "opaque_fullbleed", position: "front" },

  // --- Die-cut transparent (stickers/decals/magnets/ornaments/keychains) ---
  sticker:       { width: 1500, height: 1500, bgMode: "die_cut", position: "front" },
  wall_decal:    { width: 2400, height: 2400, bgMode: "die_cut", position: "front" },
  magnet:        { width: 1200, height: 1200, bgMode: "die_cut", position: "front" },
  ornament:      { width: 1500, height: 1500, bgMode: "die_cut", position: "front" },
  stocking:      { width: 2400, height: 3600, bgMode: "die_cut", position: "front" },
  keychain:      { width: 1181, height: 1181, bgMode: "die_cut", position: "front" },
};

export function getPrintSpec(productType: string): PrintSpec | null {
  return PRINT_SPECS[productType] ?? null;
}

/**
 * Printify placeholder image placement enforcing full-bleed / fit behavior
 * per bgMode. For mug (`white_centered`) the design lives in the center 30%
 * of the wrap so we explicitly scale it down; everything else fills the
 * entire print area edge-to-edge with no auto-centering letterboxing.
 */
export function placeholderPlacement(spec: PrintSpec, imageId: string) {
  if (spec.bgMode === "white_centered") {
    return { id: imageId, x: 0.5, y: 0.5, scale: 0.33, angle: 0 };
  }
  // transparent / die_cut / opaque_fullbleed → fill the print area.
  return { id: imageId, x: 0.5, y: 0.5, scale: 1.0, angle: 0 };
}

function stripProductMockupLanguage(prompt: string, productType: string): string {
  let out = (prompt || "").trim();
  if (productType === "phone_case_slim" || productType === "phone_case_tough") {
    out = out
      .replace(/\bfor\s+a\s+(slim|tough)\s+phone\s+case\b/gi, "as vertical print artwork")
      .replace(/\b(slim|tough)\s+phone\s+case\b/gi, "vertical print artwork")
      .replace(/\bphone\s+case\b/gi, "vertical print artwork")
      .replace(/\bcase\b/gi, "print artwork");
  }
  return out.replace(/\s+/g, " ").trim();
}

export function buildPrintPrompt(originalPrompt: string, productType: string): string {
  const spec = getPrintSpec(productType);
  if (!spec) return originalPrompt;
  const core = stripProductMockupLanguage(originalPrompt, productType)
    .replace(/Sized for[^.]*\./gi, "")
    .replace(/Output dimensions:[^.]*\./gi, "")
    .replace(/Edge-to-edge full-bleed design[^.]*\./gi, "")
    .replace(/Isolated print-ready graphic[^.]*\./gi, "")
    .replace(/Solid pure white[^.]*\./gi, "")
    .replace(/No watermarks[^.]*\./gi, "")
    .replace(/No mockup[^.]*\./gi, "")
    .trim();
  const productGuard = productType === "phone_case_slim" || productType === "phone_case_tough"
    ? "CRITICAL: create ONLY the flat 2D artwork file, not a product mockup. Do NOT draw a phone, phone case, iPhone, camera lens, buttons, bevel, white shell, side view, shadowed device, or any object outline. The entire canvas is the printable artwork; background color/design must reach every edge. Keep key text and faces away from the top-left camera cutout safe zone."
    : "No product mockups, no garments, no device frames — just the standalone print artwork file.";
  return `${core}\n\n${productGuard}\n${bgPromptFragment(spec, productType)} High-contrast bold flat vector style. No watermarks.`;
}

export async function normalizeToSpec(base64: string, spec: PrintSpec): Promise<string> {
  const bytes = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
  const src = await decode(bytes) as Image;
  const tw = spec.width, th = spec.height;
  let out: Image;

  if (spec.bgMode === "opaque_fullbleed" || spec.bgMode === "die_cut") {
    const scale = Math.max(tw / src.width, th / src.height);
    const nw = Math.round(src.width * scale);
    const nh = Math.round(src.height * scale);
    const scaled = src.clone().resize(nw, nh);
    out = new Image(tw, th);
    if (spec.bgMode === "opaque_fullbleed") out.fill(scaled.getPixelAt(1, 1));
    out.composite(scaled, Math.round((tw - nw) / 2), Math.round((th - nh) / 2));
  } else if (spec.bgMode === "white_centered") {
    const innerW = Math.round(tw * 0.33);
    const scale = Math.min(innerW / src.width, th / src.height);
    const nw = Math.round(src.width * scale);
    const nh = Math.round(src.height * scale);
    const scaled = src.clone().resize(nw, nh);
    out = new Image(tw, th);
    out.fill(0xffffffff);
    out.composite(scaled, Math.round((tw - nw) / 2), Math.round((th - nh) / 2));
  } else {
    const scale = Math.min(tw / src.width, th / src.height);
    const nw = Math.round(src.width * scale);
    const nh = Math.round(src.height * scale);
    const scaled = src.clone().resize(nw, nh);
    out = new Image(tw, th);
    out.composite(scaled, Math.round((tw - nw) / 2), Math.round((th - nh) / 2));
  }

  const png = await out.encode();
  let bin = "";
  for (let i = 0; i < png.length; i++) bin += String.fromCharCode(png[i]);
  return btoa(bin);
}

/** Build the prompt fragment that instructs the image model on bg + dimensions. */
export function bgPromptFragment(spec: PrintSpec, productType: string): string {
  const dims = `Output dimensions: ${spec.width}x${spec.height} pixels (exact).`;
  switch (spec.bgMode) {
    case "transparent":
      return `Isolated print-ready graphic on a 100% transparent background. NO background rectangle, NO white box, NO canvas fill. Artwork fills 78–85% of the canvas. ${dims}`;
    case "die_cut":
      return `Die-cut style: subject only, 100% transparent background, no white halo, no border. Artwork fills 80–90% of the canvas. ${dims}`;
    case "white_centered":
      return `Solid pure white #FFFFFF background. All artwork (text + illustration) confined to the CENTER 30% of the canvas — middle third horizontally and vertically. Outer 70% is empty white space (mug wraps around cylinder; outside the center is cut off). Compact, centered, short text only. ${dims}`;
    case "opaque_fullbleed":
      return `Edge-to-edge full-bleed design with a fully OPAQUE background color (no transparency, no white margins, no border). The background must extend to all four edges. Pick a bold cohesive background color that complements the artwork. Design fills 100% of the canvas. ${dims}`;
  }
}

/** Validate base64 PNG matches required pixel dimensions (±2px tolerance). */
export async function validateImageDimensions(
  base64: string,
  spec: PrintSpec,
): Promise<{ ok: boolean; width?: number; height?: number; reason?: string }> {
  try {
    // PNG signature + IHDR is at bytes 16–24 (big-endian width then height).
    const bin = atob(base64.slice(0, 100));
    if (bin.charCodeAt(0) !== 0x89 || bin.charCodeAt(1) !== 0x50) {
      return { ok: false, reason: "not_png" };
    }
    const w = (bin.charCodeAt(16) << 24) | (bin.charCodeAt(17) << 16) | (bin.charCodeAt(18) << 8) | bin.charCodeAt(19);
    const h = (bin.charCodeAt(20) << 24) | (bin.charCodeAt(21) << 16) | (bin.charCodeAt(22) << 8) | bin.charCodeAt(23);
    const tol = 2;
    const wOk = Math.abs(w - spec.width) <= tol;
    const hOk = Math.abs(h - spec.height) <= tol;
    if (!wOk || !hOk) {
      return { ok: false, width: w, height: h, reason: `dim_mismatch_expected_${spec.width}x${spec.height}_got_${w}x${h}` };
    }
    return { ok: true, width: w, height: h };
  } catch (e) {
    return { ok: false, reason: `parse_error_${(e as Error).message}` };
  }
}

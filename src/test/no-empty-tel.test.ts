import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Regression guard: catches buttons/links that would silently no-op on mobile
 * because they fall back to an empty `tel:`/`mailto:`/`sms:` URL.
 *
 * Real-world bug this prevents (2026-05-08): "Call Now" on a claimed Trade Radar
 * lead with no enriched owner_phone opened `tel:` with an empty string —
 * Android Chrome treated it as a no-op and the user saw nothing happen.
 */

const ROOT = path.resolve(__dirname, "..");

function* walk(dir: string): Generator<string> {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) yield full;
  }
}

const FORBIDDEN_PATTERNS: { name: string; re: RegExp }[] = [
  { name: "tel: with `?? \"\"` empty fallback", re: /tel:\$\{[^}]*\?\?\s*["'`]\s*["'`]/ },
  { name: "tel: with `|| \"\"` empty fallback", re: /tel:\$\{[^}]*\|\|\s*["'`]\s*["'`]/ },
  { name: "mailto: with `?? \"\"` empty fallback", re: /mailto:\$\{[^}]*\?\?\s*["'`]\s*["'`]/ },
  { name: "mailto: with `|| \"\"` empty fallback", re: /mailto:\$\{[^}]*\|\|\s*["'`]\s*["'`]/ },
  { name: "sms: with empty fallback", re: /sms:\$\{[^}]*(?:\?\?|\|\|)\s*["'`]\s*["'`]/ },
];

describe("no empty tel:/mailto:/sms: fallbacks", () => {
  it("never ships a contact link that resolves to an empty string", () => {
    const violations: string[] = [];
    for (const file of walk(ROOT)) {
      // Skip the test itself
      if (file.endsWith("no-empty-tel.test.ts")) continue;
      const content = fs.readFileSync(file, "utf8");
      const lines = content.split("\n");
      lines.forEach((line, i) => {
        for (const { name, re } of FORBIDDEN_PATTERNS) {
          if (re.test(line)) {
            violations.push(
              `${path.relative(ROOT, file)}:${i + 1} — ${name}\n    ${line.trim()}`
            );
          }
        }
      });
    }
    expect(violations, `Found ${violations.length} dead contact-link fallbacks:\n\n${violations.join("\n\n")}`).toEqual([]);
  });
});

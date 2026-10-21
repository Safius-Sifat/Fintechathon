import assert from "node:assert/strict";
import test from "node:test";
import { palettes, type Colors } from "../src/palettes";

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * lin((n >> 16) & 255) +
    0.7152 * lin((n >> 8) & 255) +
    0.0722 * lin(n & 255)
  );
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi! + 0.05) / (lo! + 0.05);
}

test("palettes: light and dark define the same keys", () => {
  assert.deepEqual(
    Object.keys(palettes.light).sort(),
    Object.keys(palettes.dark).sort(),
  );
});

for (const name of ["light", "dark"] as const) {
  const c: Colors = palettes[name];
  test(`palettes: ${name} text meets 4.5:1 on the ground and raised surfaces`, () => {
    for (const text of [c.ink, c.ink2, c.ink3]) {
      assert.ok(contrast(text, c.ground) >= 4.5, `${text} on ground`);
      assert.ok(contrast(text, c.raised) >= 4.5, `${text} on raised`);
    }
  });
  test(`palettes: ${name} accent text meets 4.5:1 on the ground`, () => {
    assert.ok(contrast(c.accent, c.ground) >= 4.5);
  });
  test(`palettes: ${name} button label meets 4.5:1 on ink`, () => {
    assert.ok(contrast(c.onInk, c.ink) >= 4.5);
  });
  test(`palettes: ${name} primary meets 4.5:1 for its label and as text`, () => {
    assert.ok(contrast(c.onPrimary, c.primary) >= 4.5, "label on primary");
    assert.ok(contrast(c.primary, c.ground) >= 4.5, "primary on ground");
    assert.ok(contrast(c.primary, c.primaryTint) >= 4.5, "primary on tint");
    assert.ok(contrast(c.ink, c.primaryTint) >= 4.5, "ink on tint");
  });
  test(`palettes: ${name} status colours meet 4.5:1 on raised`, () => {
    for (const s of [c.good, c.warn, c.bad])
      assert.ok(contrast(s, c.raised) >= 4.5, `${s} on raised`);
  });
}

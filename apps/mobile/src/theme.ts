// Visual direction: soft light wallet UI (cool off-white canvas with blue and
// peach glows, white cards, dark navy hero, tinted icon tiles). Personal =
// blue, Agent = amber; the two are never mixed in one surface.

export const colors = {
  background: "#F4F6FA",
  surface: "#FFFFFF",
  surfaceMuted: "#EEF1F6",
  hairline: "rgba(15, 23, 42, 0.07)",
  ink: "#0F172A",
  text: "#0F172A",
  textMuted: "#5B6475",
  textSubtle: "#8A93A3",
  textDisabled: "#9AA3B2",
  onDark: "#FFFFFF",
  onDarkMuted: "rgba(255, 255, 255, 0.68)",
  onDarkDisabled: "rgba(255, 255, 255, 0.45)",
  heroFill: "rgba(255, 255, 255, 0.10)",
  heroLine: "rgba(255, 255, 255, 0.14)",
  personal: "#2F6BDF",
  agent: "#C2620E",
  ok: "#1E8A4C",
  stop: "#C23B33",
} as const;

// Icon tile tones (background, glyph).
export const tones = {
  blue: { bg: "#E6EEFF", fg: "#2F6BDF" },
  amber: { bg: "#FFEEDD", fg: "#C2620E" },
  green: { bg: "#E2F5EA", fg: "#1E8A4C" },
  violet: { bg: "#EEE9FF", fg: "#6A4BD8" },
  slate: { bg: "#EAEEF4", fg: "#475569" },
  red: { bg: "#FDE8E7", fg: "#C23B33" },
} as const;

export type Tone = keyof typeof tones;

export const gradients = {
  // Ambient canvas glows behind every screen.
  canvas:
    "radial-gradient(circle at 0% 0%, rgba(140, 178, 255, 0.40) 0%, rgba(140, 178, 255, 0) 60%), " +
    "radial-gradient(circle at 100% 12%, rgba(255, 196, 148, 0.38) 0%, rgba(255, 196, 148, 0) 55%)",
  hero:
    "radial-gradient(circle at 100% 0%, rgba(120, 160, 255, 0.35) 0%, rgba(120, 160, 255, 0) 55%), " +
    "linear-gradient(135deg, #22304F 0%, #121A2E 55%, #0B1120 100%)",
} as const;

export const shadows = {
  card: "0px 6px 18px rgba(15, 23, 42, 0.06)",
  hero: "0px 12px 28px rgba(15, 23, 42, 0.22)",
  bar: "0px -4px 16px rgba(15, 23, 42, 0.05)",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  tile: 14,
  lg: 20,
  hero: 24,
  pill: 999,
} as const;

// Minimum touch target (Android accessibility guidance: 48dp).
export const touchTarget = 48;

export const fonts = {
  mono: "monospace",
} as const;

export const type = {
  title: { fontSize: 30, lineHeight: 36, fontWeight: "700" },
  hero: { fontSize: 28, lineHeight: 34, fontWeight: "700" },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: "700" },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
  small: { fontSize: 13, lineHeight: 18, fontWeight: "400" },
  label: { fontSize: 12, lineHeight: 16, fontWeight: "600" },
  overline: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "600",
    letterSpacing: 0.6,
  },
} as const;

// Above this font scale, side-by-side rows stack vertically.
export const stackedFontScale = 1.3;

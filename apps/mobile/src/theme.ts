// Visual direction: calm instrument. Cool grey ground, ink text, hairline
// rules, and one wax-red accent that means "signed by you". The accent is
// never used for danger. See docs/design/DIRECTION.md.

export const colors = {
  ground: "#E8ECEB",
  raised: "#F4F6F5",
  ink: "#14191C",
  ink2: "#454E54",
  ink3: "#5A646A",
  rule: "#C6CDCF",
  accent: "#8F2A2E",
  waxTint: "#D9C2C3",
  onInk: "#F4F6F5",
  onAccent: "#F4F6F5",
  // Aliases used by existing components; migrate to the names above.
  background: "#E8ECEB",
  surface: "#F4F6F5",
  surfaceMuted: "#DDE3E2",
  hairline: "#C6CDCF",
  text: "#14191C",
  textMuted: "#454E54",
  textSubtle: "#5A646A",
  textDisabled: "#6E787E",
  onDark: "#F4F6F5",
  onDarkMuted: "rgba(244, 246, 245, 0.72)",
  onDarkDisabled: "rgba(244, 246, 245, 0.5)",
  heroFill: "rgba(244, 246, 245, 0.10)",
  heroLine: "rgba(244, 246, 245, 0.18)",
  personal: "#14191C",
  agent: "#8F2A2E",
  ok: "#14191C",
  stop: "#14191C",
} as const;

// Icon tile tones. The design uses one neutral tile, so every tone matches.
const neutralTile = { bg: "#DDE3E2", fg: "#14191C" } as const;
export const tones = {
  blue: neutralTile,
  amber: neutralTile,
  green: neutralTile,
  violet: neutralTile,
  slate: neutralTile,
} as const;

export type Tone = keyof typeof tones;

export const shadows = {
  card: "0px 1px 2px rgba(20, 25, 28, 0.06)",
  bar: "0px -1px 0px rgba(20, 25, 28, 0.08)",
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
  lg: 26,
  hero: 27,
  pill: 999,
} as const;

// Minimum touch target (Android accessibility guidance: 48dp).
export const touchTarget = 48;

// Newsreader is bundled (App.tsx loads it) so the serif voice is the same on
// Android and iOS. Mono is the platform monospace.
export const fonts = {
  serif: "Newsreader_500Medium",
  serifBold: "Newsreader_600SemiBold",
  mono: "monospace",
} as const;

export const type = {
  display: {
    fontFamily: fonts.serifBold,
    fontSize: 56,
    lineHeight: 60,
    letterSpacing: -1.5,
  },
  title: {
    fontFamily: fonts.serifBold,
    fontSize: 38,
    lineHeight: 42,
    letterSpacing: -0.9,
  },
  hero: {
    fontFamily: fonts.serifBold,
    fontSize: 28,
    lineHeight: 32,
    letterSpacing: -0.6,
  },
  voice: {
    fontFamily: fonts.serif,
    fontSize: 22,
    lineHeight: 27,
    letterSpacing: -0.4,
  },
  heading: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
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

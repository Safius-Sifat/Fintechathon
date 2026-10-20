// Light and dark colour palettes. No React Native imports, so tests can read them.

export const light = {
  ground: "#E8ECEB",
  raised: "#F4F6F5",
  tile: "#DDE3E2",
  ink: "#14191C",
  ink2: "#454E54",
  ink3: "#5A646A",
  ink4: "#6E787E",
  rule: "#C6CDCF",
  accent: "#8F2A2E",
  waxTint: "#D9C2C3",
  onInk: "#F4F6F5",
  onInkMuted: "rgba(244, 246, 245, 0.72)",
  onInkDisabled: "rgba(244, 246, 245, 0.5)",
  onAccent: "#F4F6F5",
  inkFill: "rgba(244, 246, 245, 0.10)",
  inkLine: "rgba(244, 246, 245, 0.18)",
  glass: "rgba(255, 255, 255, 0.72)",
  ripple: "rgba(20, 25, 28, 0.08)",
  rippleOnInk: "rgba(244, 246, 245, 0.16)",
  rippleOnRaised: "rgba(20, 25, 28, 0.12)",
  outline: "rgba(20, 25, 28, 0.14)",
  statusBar: "dark",
} as const;

export type Colors = { [K in keyof typeof light]: string };

export const dark: Colors = {
  ground: "#0F1315",
  raised: "#171D20",
  tile: "#232B2F",
  ink: "#ECEAE3",
  ink2: "#A7AFB3",
  ink3: "#8C969B",
  ink4: "#6B757A",
  rule: "#283034",
  accent: "#C95B5F",
  waxTint: "#3A2527",
  onInk: "#0F1315",
  onInkMuted: "rgba(15, 19, 21, 0.72)",
  onInkDisabled: "rgba(15, 19, 21, 0.5)",
  onAccent: "#0F1315",
  inkFill: "rgba(15, 19, 21, 0.08)",
  inkLine: "rgba(15, 19, 21, 0.16)",
  glass: "rgba(23, 29, 32, 0.72)",
  ripple: "rgba(236, 234, 227, 0.10)",
  rippleOnInk: "rgba(15, 19, 21, 0.16)",
  rippleOnRaised: "rgba(236, 234, 227, 0.14)",
  outline: "rgba(236, 234, 227, 0.16)",
  statusBar: "light",
};

export const palettes: { light: Colors; dark: Colors } = { light, dark };

import type { ShopProduct } from "@mandate/schema";

// Original flat illustrations for the sample products: one side-view shoe
// drawn from the product's colours and category. No third-party imagery.
const COLORS: Record<string, string> = {
  blue: "#2B55C9",
  white: "#F4F6F5",
  orange: "#E8742A",
  black: "#1E2326",
  grey: "#8A949A",
  green: "#2F8F5B",
  olive: "#6F7A3A",
  red: "#C7372F",
  navy: "#1F2E5A",
  purple: "#6B4FB8",
};

const shade = (hex: string, by: number) => {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) =>
    Math.max(0, Math.min(255, Math.round(v + by)))
      .toString(16)
      .padStart(2, "0");
  return `#${c((n >> 16) & 255)}${c((n >> 8) & 255)}${c(n & 255)}`;
};

export function productSvg(p: ShopProduct): string {
  const main = COLORS[p.colors[0]!] ?? "#8A949A";
  const accent = COLORS[p.colors[1] ?? "white"] ?? "#F4F6F5";
  const sole = p.category === "trail" ? "#3A3F42" : "#F4F6F5";
  const lugs =
    p.category === "trail"
      ? Array.from(
          { length: 9 },
          (_, i) =>
            `<rect x="${92 + i * 26}" y="226" width="14" height="10" rx="3" fill="#3A3F42"/>`,
        ).join("")
      : "";
  const high = p.category === "court" ? 0 : p.category === "lifestyle" ? 6 : -8;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300" role="img" aria-label="${p.name}">
  <rect width="400" height="300" rx="28" fill="${shade(main, 150)}"/>
  <ellipse cx="200" cy="246" rx="150" ry="12" fill="#000" opacity="0.08"/>
  <path d="M70 ${190 + high} C70 ${150 + high} 104 ${112 + high} 150 ${108 + high} L196 ${102 + high} C214 ${118 + high} 236 ${132 + high} 268 ${142 + high} C312 ${156 + high} 340 ${170 + high} 344 196 L344 214 L70 214 Z" fill="${main}"/>
  <path d="M150 ${108 + high} L196 ${102 + high} C206 ${112 + high} 214 ${120 + high} 224 ${126 + high} L178 ${150 + high} Z" fill="${shade(main, -28)}"/>
  <path d="M120 ${184 + high} C170 ${166 + high} 236 ${160 + high} 300 ${178 + high}" stroke="${accent}" stroke-width="12" stroke-linecap="round" fill="none"/>
  <path d="M286 ${150 + high} C318 ${160 + high} 340 ${176 + high} 344 196 L344 206 L300 206 C298 ${182 + high} 292 ${164 + high} 286 ${150 + high} Z" fill="${shade(main, -18)}"/>
  ${[0, 1, 2]
    .map(
      (i) =>
        `<line x1="${190 + i * 16}" y1="${118 + high + i * 6}" x2="${206 + i * 16}" y2="${108 + high + i * 6}" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>`,
    )
    .join("")}
  <rect x="62" y="210" width="290" height="22" rx="11" fill="${sole}" stroke="${shade(sole, -40)}" stroke-width="2"/>
  ${lugs}
</svg>`;
}

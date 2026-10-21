import { ShopProductSchema, type ShopProduct } from "@mandate/schema";

// The demo shop's sample catalogue. Products, brands and prices are invented;
// prices sit under the contract's 0.50 per-payment ceiling. Nothing ships.
const SIZES = ["39", "40", "41", "42", "43", "44", "45"];

const product = (
  p: Omit<ShopProduct, "image" | "sizes"> & { sizes?: string[] },
): ShopProduct =>
  ShopProductSchema.parse({
    sizes: SIZES,
    ...p,
    image: `/shop/images/${p.productId}.svg`,
  });

export const CATALOG: readonly ShopProduct[] = [
  product({
    productId: "aero-runner",
    name: "Aero Runner",
    brand: "Northfield",
    category: "running",
    colors: ["blue", "white"],
    price: "450000",
    description: "Light daily trainer with a responsive foam midsole.",
  }),
  product({
    productId: "tempo-glide",
    name: "Tempo Glide",
    brand: "Kestrel",
    category: "running",
    colors: ["orange", "black"],
    price: "380000",
    description: "Snappy tempo shoe with a firm, low-profile ride.",
  }),
  product({
    productId: "cloudstep-lite",
    name: "Cloudstep Lite",
    brand: "Northfield",
    category: "running",
    colors: ["white", "grey"],
    price: "290000",
    description: "Soft, cushioned shoe for easy miles.",
  }),
  product({
    productId: "marathon-pro",
    name: "Marathon Pro",
    brand: "Vela",
    category: "running",
    colors: ["green", "black"],
    price: "490000",
    description: "Race-day shoe with a stiff plate and minimal upper.",
  }),
  product({
    productId: "ridge-trail",
    name: "Ridge Trail",
    brand: "Kestrel",
    category: "trail",
    colors: ["olive", "orange"],
    price: "420000",
    description: "Grippy lugs and a rock plate for rough paths.",
  }),
  product({
    productId: "summit-grip",
    name: "Summit Grip",
    brand: "Vela",
    category: "trail",
    colors: ["grey", "red"],
    price: "350000",
    description: "Water-shedding upper and sticky rubber outsole.",
  }),
  product({
    productId: "baseline-court",
    name: "Baseline Court",
    brand: "Northfield",
    category: "court",
    colors: ["white", "green"],
    price: "330000",
    description: "Stable court shoe with a reinforced toe.",
  }),
  product({
    productId: "rally-low",
    name: "Rally Low",
    brand: "Kestrel",
    category: "court",
    colors: ["white", "navy"],
    price: "260000",
    description: "Low-cut court shoe for quick side steps.",
  }),
  product({
    productId: "city-classic",
    name: "City Classic",
    brand: "Vela",
    category: "lifestyle",
    colors: ["black", "white"],
    price: "240000",
    description: "Everyday leather-look sneaker.",
  }),
  product({
    productId: "canvas-easy",
    name: "Canvas Easy",
    brand: "Northfield",
    category: "lifestyle",
    colors: ["red", "white"],
    price: "180000",
    description: "Simple canvas shoe with a vulcanised sole.",
  }),
  product({
    productId: "drift-slip-on",
    name: "Drift Slip-On",
    brand: "Kestrel",
    category: "lifestyle",
    colors: ["navy", "white"],
    price: "200000",
    description: "Laceless slip-on for short trips.",
  }),
  product({
    productId: "nova-knit",
    name: "Nova Knit",
    brand: "Vela",
    category: "lifestyle",
    colors: ["purple", "white"],
    price: "310000",
    description: "Breathable knit upper with a cushioned sole.",
  }),
];

export const productById = (id: string) =>
  CATALOG.find((p) => p.productId === id) ?? null;

export interface CatalogQuery {
  q?: string | undefined;
  category?: string | undefined;
  size?: string | undefined;
  maxPrice?: string | undefined;
  limit?: number | undefined;
}

// Plain filtering: every word of the query must appear in the product text.
export function searchCatalog(query: CatalogQuery): ShopProduct[] {
  const words = (query.q ?? "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  const max =
    query.maxPrice && /^[0-9]+$/.test(query.maxPrice)
      ? BigInt(query.maxPrice)
      : null;
  return CATALOG.filter((p) => {
    const text =
      `${p.name} ${p.brand} ${p.category} ${p.colors.join(" ")} ${p.description}`.toLowerCase();
    return (
      words.every((w) => text.includes(w) || text.includes(singular(w))) &&
      (!query.category || p.category === query.category) &&
      (!query.size || p.sizes.includes(query.size)) &&
      (max === null || BigInt(p.price) <= max)
    );
  }).slice(0, Math.min(Math.max(query.limit ?? 6, 1), 12));
}

const singular = (w: string) => (w.endsWith("s") ? w.slice(0, -1) : w);
const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "me",
  "my",
  "for",
  "some",
  "pair",
  "of",
  "shoe",
  "shoes",
  "sneaker",
  "sneakers",
  "buy",
  "find",
  "want",
  "under",
  "usdc",
  "with",
  "and",
  "size",
]);

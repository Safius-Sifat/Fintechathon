// Writes packages/schema/fixtures/*-v7.json. Run: pnpm --filter @mandate/schema vectors
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { buildVectors } from "./vectors.js";

const dir = resolve(import.meta.dirname, "../fixtures");
await mkdir(dir, { recursive: true });
for (const [name, value] of Object.entries(await buildVectors()))
  await writeFile(resolve(dir, name), JSON.stringify(value, null, 2) + "\n");
console.log(`Wrote vectors to ${dir}`);

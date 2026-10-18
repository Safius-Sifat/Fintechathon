import { readFileSync } from "node:fs";
import { resolve } from "node:path";

export const fixturesDir = resolve(import.meta.dirname, "../../fixtures");
export const loadFixture = <T = any>(name: string): T =>
  JSON.parse(readFileSync(resolve(fixturesDir, name), "utf8")) as T;

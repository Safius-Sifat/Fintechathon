import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { hashCanonical } from "@mandate/schema";
import { loadScreening } from "../src/screening.js";

test("the screening list loads only when its canonical hash matches the manifest", async () => {
  const path = new URL("../rules/demo-screening-v1.json", import.meta.url)
    .pathname;
  const hash = hashCanonical(JSON.parse(await readFile(path, "utf8")));
  const list = await loadScreening(path, hash);
  assert.ok(list.has("0x000000000000000000000000000000000000dead"));
  await assert.rejects(
    loadScreening(path, "0x" + "00".repeat(32)),
    /hash does not match/,
  );
});

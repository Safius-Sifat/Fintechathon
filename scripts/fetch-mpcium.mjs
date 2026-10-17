import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
const commit = "90e3ee3c15e6698ade5626ff6c6b49d2453d8ce2";
const dir = "vendor/mpcium";
function run(args) {
  const r = spawnSync("git", args, { stdio: "inherit" });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
if (existsSync(dir)) {
  console.error(
    `${dir} exists; preserve it and inspect its commit manually. Expected ${commit}.`,
  );
  process.exit(1);
}
mkdirSync("vendor", { recursive: true });
run(["clone", "--no-checkout", "https://github.com/fystack/mpcium.git", dir]);
run(["-C", dir, "checkout", "--detach", commit]);
console.log(
  "Pinned MPCium source fetched. No node started, no keys generated. Follow docs/plans/02 - Platform Policy and MPCium.md.",
);

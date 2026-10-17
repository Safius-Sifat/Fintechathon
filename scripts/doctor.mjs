import { spawnSync } from "node:child_process";
const expected = 22;
let failed = Number(process.versions.node.split(".")[0]) !== expected;
console.log(`Node ${process.versions.node}: ${failed ? "use .nvmrc" : "OK"}`);
for (const [name, args, required] of [
  ["pnpm", ["--version"], true],
  ["docker", ["compose", "version"], false],
  ["forge", ["--version"], false],
  ["go", ["version"], false],
  ["java", ["-version"], false],
]) {
  const r = spawnSync(name, args, { encoding: "utf8" });
  const ok = !r.error && r.status === 0;
  console.log(
    `${name}: ${ok ? (r.stdout || r.stderr).trim().split("\n")[0] : "not available"}${required ? "" : " (role-specific)"}`,
  );
  if (required && !ok) failed = true;
}
console.log(
  "Go adapter requires Go1.25.8. Native Android owner signing and MPC qualification remain implementation gates.",
);
process.exitCode = failed ? 1 : 0;

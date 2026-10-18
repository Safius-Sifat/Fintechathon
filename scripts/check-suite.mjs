// Runs one owned test suite and fails unless it ran at least one test and none failed.
// Usage:
//   node scripts/check-suite.mjs node <pnpm-filter>          (runs the package "check" script)
//   node scripts/check-suite.mjs forge <root> <match-path>   (runs forge test)
import { spawnSync } from "node:child_process";

const [kind, target, match] = process.argv.slice(2);
const fail = (message) => {
  console.error(`check-suite: ${message}`);
  process.exit(1);
};
let command;
let args;
if (kind === "node" && target) {
  command = "./scripts/pnpm.sh";
  args = ["--filter", target, "check"];
} else if (kind === "forge" && target && match) {
  command = "forge";
  args = ["test", "--root", target, "--match-path", match];
} else {
  fail("usage: check-suite.mjs node <filter> | forge <root> <match-path>");
}
const run = spawnSync(command, args, {
  encoding: "utf8",
  maxBuffer: 64 * 1024 * 1024,
});
if (run.error)
  fail(
    `${command} could not start (${run.error.code ?? run.error.message}). Install the required toolchain.`,
  );
const output = `${run.stdout}${run.stderr}`;
process.stdout.write(output);
if (run.status !== 0) fail(`${kind} suite exited with status ${run.status}`);
let passed = 0;
if (kind === "node") {
  const tests = Number(/^# tests (\d+)$/m.exec(output)?.[1] ?? 0);
  const failed = Number(/^# fail (\d+)$/m.exec(output)?.[1] ?? 1);
  if (failed !== 0) fail(`${failed} node tests failed`);
  passed = tests;
} else {
  for (const m of output.matchAll(
    /Suite result: ok\. (\d+) passed; (\d+) failed/g,
  )) {
    if (Number(m[2]) !== 0) fail("forge reported failures");
    passed += Number(m[1]);
  }
}
if (passed === 0)
  fail(`no ${kind} tests ran for ${target}; an empty suite is not a pass`);
console.log(`check-suite: ${kind} ${target} passed ${passed} tests`);

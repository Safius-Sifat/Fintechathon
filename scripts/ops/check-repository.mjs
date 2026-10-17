import { readdir, readFile, lstat } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { workflowProblems, secretProblems } from "./policy.mjs";
const failures = [];
for (const name of await readdir(".github/workflows")) {
  if (!/\.ya?ml$/.test(name)) continue;
  for (const p of workflowProblems(
    await readFile(join(".github/workflows", name), "utf8"),
  ))
    failures.push({ file: name, rule: p });
}
// Include current untracked bootstrap files; exclude private/ignored local files through Git's own rules.
const files = execFileSync(
  "git",
  ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
  { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
)
  .split("\0")
  .filter(Boolean);
for (const path of files) {
  const stat = await lstat(path);
  if (stat.isSymbolicLink()) {
    failures.push({ file: path, rule: "SOURCE_SYMLINK_REVIEW_REQUIRED" });
    continue;
  }
  if (!stat.isFile()) continue;
  if (stat.size > 5 * 1024 * 1024) {
    failures.push({ file: path, rule: "OVERSIZE_SOURCE_REVIEW_REQUIRED" });
    continue;
  }
  const text = await readFile(path, "utf8");
  for (const issue of secretProblems(path, text))
    failures.push({ file: path, rule: issue });
}
// Azure activation is one GitHub environment variable, not a second in-repo switch.
console.log(
  JSON.stringify(
    {
      scope: "repository-foundation",
      financialAcceptance: "NOT_IMPLEMENTED",
      deploymentActivation:
        "GitHub repository variable AZURE_DEPLOY_ENABLED; unset by default",
      checkedFiles: files.length,
      failures,
    },
    null,
    2,
  ),
);
if (failures.length) process.exitCode = 1;

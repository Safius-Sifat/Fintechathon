// Release gate (P1-06.T05). Reports PASS only when every mandatory case in docs/plans and every
// wallet case WQ01-WQ14 has a well-formed PASS record, no record failed, and the release manifest
// validates and matches the recorded deployment. LOCAL_PASS, BLOCKED and unrecorded cases keep the
// release INCOMPLETE. Run: node --import tsx scripts/release-check.mjs
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DeploymentManifestSchema } from "../packages/schema/src/manifest.ts";

const CASE_ROW = /^\| `([A-Z0-9]+-[A-Z0-9]+\.T[0-9]+)` \|/gm;
const COMMIT = /^[0-9a-f]{40}$/;
const CONTRACTS = ["factory", "token", "vault", "anchor"];

const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));

function requiredCases(root) {
  const ids = new Set();
  const plans = join(root, "docs/plans");
  for (const file of readdirSync(plans).filter((f) => f.endsWith(".md")))
    for (const [, id] of readFileSync(join(plans, file), "utf8").matchAll(
      CASE_ROW,
    ))
      ids.add(id);
  const app = readFileSync(join(root, "docs/COMPLETE-APP.md"), "utf8").match(
    /Required wallet cases:[^\n]*/,
  );
  for (const [id] of app?.[0].matchAll(/WQ[0-9]{2}/g) ?? []) ids.add(id);
  return [...ids].sort();
}

// Case files are arrays of per-case records; any other shape is reported and counts for nothing.
function records(root) {
  const out = [];
  const invalidFiles = [];
  const evidence = join(root, "evidence");
  for (const person of readdirSync(evidence)) {
    const dir = join(evidence, person, "cases");
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
      const content = readJson(join(dir, file));
      if (Array.isArray(content)) out.push(...content);
      else invalidFiles.push(`evidence/${person}/cases/${file}`);
    }
  }
  return { all: out, invalidFiles };
}

const malformedPass = (r) =>
  !COMMIT.test(r.sourceCommit ?? "") || r.exitCode !== 0 || !r.observed;

function manifestErrors(root) {
  const path = join(root, "deployments/base-sepolia.json");
  if (!existsSync(path))
    return {
      missing: true,
      errors: ["deployments/base-sepolia.json does not exist"],
    };
  const parsed = DeploymentManifestSchema.safeParse(readJson(path));
  if (!parsed.success)
    return {
      missing: false,
      errors: parsed.error.issues.map(
        (i) => `${i.path.join(".") || "manifest"}: ${i.message}`,
      ),
    };
  const deploymentPath = join(root, "evidence/person1/deployment.json");
  if (!existsSync(deploymentPath))
    return {
      missing: false,
      errors: ["evidence/person1/deployment.json does not exist"],
    };
  const deployment = readJson(deploymentPath);
  const errors = [];
  if (deployment.chainId !== parsed.data.chainId)
    errors.push("chainId differs from evidence/person1/deployment.json");
  for (const name of CONTRACTS)
    for (const field of ["address", "deploymentBlock", "codeHash"])
      if (
        String(parsed.data.contracts[name][field]).toLowerCase() !==
        String(deployment.contracts?.[name]?.[field]).toLowerCase()
      )
        errors.push(
          `contracts.${name}.${field} differs from evidence/person1/deployment.json`,
        );
  return { missing: false, errors };
}

export function evaluateRelease({ root }) {
  const required = requiredCases(root);
  const { all, invalidFiles } = records(root);
  const invalid = all
    .filter((r) => r.status === "PASS" && malformedPass(r))
    .map(({ caseId }) => ({ caseId }));
  const passed = new Set(
    all
      .filter((r) => r.status === "PASS" && !malformedPass(r))
      .map((r) => r.caseId),
  );
  const failed = [
    ...new Set(all.filter((r) => r.status === "FAIL").map((r) => r.caseId)),
  ].sort();
  const missing = required.filter((id) => !passed.has(id));
  const manifest = manifestErrors(root);
  const manifestBroken = !manifest.missing && manifest.errors.length > 0;
  const status =
    failed.length || manifestBroken
      ? "FAIL"
      : missing.length || manifest.missing
        ? "INCOMPLETE"
        : "PASS";
  return {
    status,
    required: required.length,
    passed: required.length - missing.length,
    missing,
    failed,
    invalid,
    invalidFiles,
    manifestErrors: manifest.missing ? [] : manifest.errors,
    manifestMissing: manifest.missing,
  };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const result = evaluateRelease({
    root: new URL("..", import.meta.url).pathname,
  });
  console.log(JSON.stringify(result, null, 2));
  console.log(
    `release: ${result.status} (${result.passed}/${result.required} mandatory cases PASS)`,
  );
  if (result.status !== "PASS") process.exitCode = 1;
}

#!/usr/bin/env node
import { loadBundle } from "./bundle.js";
import { verifyBundle, computeExitCode } from "./verifier.js";
import { writeFile } from "node:fs/promises";

async function main() {
  const args = process.argv.slice(2);
  let bundlePath = "";
  let trustedPath = "";
  let rpcUrl = "";
  let outPath = "";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--bundle" && args[i + 1]) {
      bundlePath = args[++i]!;
    } else if (args[i] === "--trusted" && args[i + 1]) {
      trustedPath = args[++i]!;
    } else if (args[i] === "--rpc" && args[i + 1]) {
      rpcUrl = args[++i]!;
    } else if (args[i] === "--out" && args[i + 1]) {
      outPath = args[++i]!;
    }
  }

  if (!bundlePath) {
    console.error("Usage: mandate-verify --bundle <path> [--trusted <manifest>] [--rpc <url>] [--out <report>]");
    process.exit(3);
  }

  try {
    const bundle = await loadBundle(bundlePath);
    const report = await verifyBundle(bundle, { rpcUrl });

    console.log("\n================ MANDATE VERIFIER REPORT ================");
    console.log(`Task ID:         ${report.taskId}`);
    console.log(`Inspection Head: Block ${report.inspectionHead}\n`);

    for (const f of report.findings) {
      const icon = f.state === "PASS" ? "✓ PASS" : f.state === "FAIL" ? "✗ FAIL" : `? ${f.state}`;
      console.log(`  [${icon.padEnd(8)}] ${f.name.toUpperCase()}: ${f.ruleId}`);
      console.log(`            ${f.reason}`);
    }
    console.log("=========================================================\n");

    if (outPath) {
      await writeFile(outPath, JSON.stringify(report, null, 2), "utf-8");
      console.log(`Report written to ${outPath}`);
    }

    const exitCode = computeExitCode(report);
    process.exit(exitCode);
  } catch (err: any) {
    console.error("Verifier Error:", err.message);
    process.exit(3);
  }
}

main();

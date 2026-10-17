import { readFile } from "node:fs/promises";
export function commandSucceeded(value, commit) {
  if (!/^[a-f0-9]{40}$/.test(commit)) return false;
  return (value?.value ?? [])
    .flatMap((x) => String(x.message ?? "").split(/\r?\n/))
    .includes("MANDATE_DEPLOY_OK " + commit);
}
if (process.argv[2]) {
  const result = JSON.parse(await readFile(process.argv[2], "utf8"));
  if (!commandSucceeded(result, process.argv[3] ?? "")) {
    console.error("Deployment failed; inspect private VM release logs");
    process.exitCode = 1;
  }
}

import { parse } from "yaml";
export function workflowProblems(text) {
  const doc = parse(text);
  const errors = [];
  if (!doc || typeof doc !== "object") return ["WORKFLOW_INVALID"];
  const triggers = doc.on;
  if (
    triggers &&
    ((typeof triggers === "object" && "pull_request_target" in triggers) ||
      triggers === "pull_request_target" ||
      (Array.isArray(triggers) && triggers.includes("pull_request_target")))
  )
    errors.push("UNTRUSTED_TRIGGER");
  if (doc.permissions === "write-all") errors.push("BROAD_PERMISSIONS");
  for (const [name, job] of Object.entries(doc.jobs ?? {})) {
    if (job.permissions === "write-all")
      errors.push("BROAD_PERMISSIONS:" + name);
    if (JSON.stringify(job["runs-on"]).includes("self-hosted"))
      errors.push("SELF_HOSTED_RUNNER:" + name);
    for (const step of job.steps ?? []) {
      if (
        step.uses &&
        !step.uses.startsWith("./") &&
        !/^[\w.-]+\/[\w./-]+@[a-f0-9]{40}$/.test(step.uses)
      )
        errors.push("ACTION_NOT_PINNED:" + step.uses);
    }
    if (job.uses && !job.uses.startsWith("./"))
      errors.push("REMOTE_REUSABLE_WORKFLOW:" + name);
  }
  return errors;
}
export function secretProblems(path, text) {
  const issues = [];
  if (
    /(?:^|\/)(?:\.env(?:\..*)?|[^/]+\.(?:key|pem|jks|keystore|age|apk|aab))$/.test(
      path,
    ) &&
    !path.endsWith(".env.example")
  )
    issues.push("PRIVATE_FILE");
  if (/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text))
    issues.push("PRIVATE_KEY_CONTENT");
  if (
    /\bgh[pousr]_[A-Za-z0-9]{30,}\b/.test(text) ||
    /\bgithub_pat_[A-Za-z0-9_]{40,}\b/.test(text)
  )
    issues.push("GITHUB_TOKEN");
  if (/\bAKIA[0-9A-Z]{16}\b/.test(text)) issues.push("AWS_ACCESS_KEY");
  return issues;
}

import { readFile } from "node:fs/promises";
import { Pool } from "pg";
import { connectChain, systemClock } from "@mandate/platform";
import { DeploymentManifestSchema } from "@mandate/schema";
import { PolicyService, rpcChainReader } from "./authorize.js";
import { loadScreening } from "./screening.js";
import { createPolicyServer } from "./server.js";

const env = process.env;
if (
  !env.POLICY_DATABASE_URL ||
  !env.POLICY_DATABASE_CA_FILE ||
  !env.POLICY_INTERNAL_TOKEN_FILE
)
  throw new Error("Policy database, CA and internal token files are required");
const database = new Pool({
  connectionString: env.POLICY_DATABASE_URL,
  max: 4,
  connectionTimeoutMillis: 3000,
  ssl: {
    ca: await readFile(env.POLICY_DATABASE_CA_FILE, "utf8"),
    rejectUnauthorized: true,
  },
});
// Without a trusted manifest or RPC the service still runs and denies every request.
const manifest = env.DEPLOYMENT_MANIFEST_FILE
  ? DeploymentManifestSchema.parse(
      JSON.parse(await readFile(env.DEPLOYMENT_MANIFEST_FILE, "utf8")),
    )
  : null;
const chain = env.POLICY_RPC_URL
  ? rpcChainReader(await connectChain(env.POLICY_RPC_URL, 84532))
  : null;
const token = (await readFile(env.POLICY_INTERNAL_TOKEN_FILE, "utf8")).trim();
const screening = manifest
  ? await loadScreening(
      env.SCREENING_LIST_FILE ??
        new URL("../rules/demo-screening-v1.json", import.meta.url).pathname,
      manifest.screening.listHash,
    )
  : new Set<string>();
const app = createPolicyServer(
  new PolicyService(database, manifest, chain, systemClock, screening),
  token,
);
app.addHook("onClose", () => database.end());
await app.listen({ host: "127.0.0.1", port: Number(env.POLICY_PORT ?? 3102) });
for (const signal of ["SIGINT", "SIGTERM"] as const)
  process.once(signal, () => void app.close());

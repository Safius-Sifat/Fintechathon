import {
  ConversationService,
  httpAgentClient,
} from "./business/conversations.js";
import { readFile } from "node:fs/promises";
import { getAddress } from "viem";
import {
  connectChain,
  evidenceKey,
  startFoundationService,
} from "@mandate/platform";
import { DeploymentManifestSchema } from "@mandate/schema";
import { loadAuthConfig } from "./auth/config.js";
import { registerAuth } from "./auth/routes.js";
import { AuthService } from "./auth/service.js";
import { registerBusiness } from "./business/routes.js";
import {
  BusinessService,
  type BusinessDependencies,
} from "./business/service.js";
import { AgenticService } from "./business/agentic.js";
import { ControlService } from "./business/controls.js";
import { TaskService } from "./business/tasks.js";

const env = process.env;
const file = (name: string) => readFile(env[name]!);

await startFoundationService("api", 3000, async (app, database) => {
  let auth = null;
  try {
    auth = await loadAuthConfig(env);
  } catch {
    app.log.error(
      "Authentication configuration invalid; authentication disabled",
    );
  }
  const authService = database && auth ? new AuthService(database, auth) : null;
  await registerAuth(app, authService);
  // Each optional dependency stays null when unconfigured; its routes then fail
  // explicitly instead of returning partial financial data.
  const manifest = env.TRUSTED_MANIFEST_FILE
    ? DeploymentManifestSchema.parse(
        JSON.parse((await file("TRUSTED_MANIFEST_FILE")).toString("utf8")),
      )
    : null;
  const chain =
    env.API_RPC_URL && manifest
      ? {
          client: await connectChain(env.API_RPC_URL, 84532),
          assets: manifest.agentAssets.map((a) => ({
            address: getAddress(a.address),
            symbol: a.symbol,
          })),
        }
      : null;
  // Hex keys from files or, in the release container, the runtime env file.
  const secret = async (name: "EVIDENCE_KEY" | "ARTIFACT_KEY") =>
    env[name + "_FILE"]
      ? (await file(name + "_FILE")).toString("utf8").trim()
      : env[name]?.trim();
  const [evidenceSeed, artifactKey] = [
    await secret("EVIDENCE_KEY"),
    await secret("ARTIFACT_KEY"),
  ];
  const evidence =
    evidenceSeed && artifactKey
      ? {
          key: evidenceKey(Buffer.from(evidenceSeed, "hex")),
          artifactKey: Buffer.from(artifactKey, "hex"),
        }
      : null;
  const deps: BusinessDependencies = {
    chain,
    evidence,
    manifest,
    intentCompiler: null,
    // The chat agent service (plan 05); without it, sending a message
    // answers 503 instead of a made-up reply.
    agent:
      env.AGENT_SERVICE_URL && env.AGENT_SERVICE_TOKEN
        ? httpAgentClient(env.AGENT_SERVICE_URL, env.AGENT_SERVICE_TOKEN)
        : null,
  };
  await registerBusiness(
    app,
    database && authService
      ? new BusinessService(database, authService, deps, () =>
          Math.floor(Date.now() / 1000),
        )
      : null,
    database
      ? new AgenticService(
          database,
          () => Math.floor(Date.now() / 1000),
          null,
          manifest,
        )
      : null,
    database
      ? new ControlService(database, chain?.client ?? null, () =>
          Math.floor(Date.now() / 1000),
        )
      : null,
    database
      ? new TaskService(database, chain?.client ?? null, manifest, () =>
          Math.floor(Date.now() / 1000),
        )
      : null,
    database
      ? new ConversationService(
          database,
          () => Math.floor(Date.now() / 1000),
          deps.agent ?? null,
        )
      : null,
  );
});

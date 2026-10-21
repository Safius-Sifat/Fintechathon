import { startFoundationService } from "@mandate/platform";
import { HTTPFacilitatorClient } from "@x402/core/http";
import { createPublicClient, http, type Hex } from "viem";
import { baseSepolia } from "viem/chains";
import { registerProviderRoutes } from "./routes.js";
import { InvoiceStore, RecordStore } from "./store.js";
import { registerShopRoutes, type OrderRecord } from "./shop/routes.js";

const env = (name: string) => process.env[name] || undefined;
const key = (name: string) => {
  const value = env(name);
  return value && /^0x[0-9a-fA-F]{64}$/.test(value)
    ? (value as Hex)
    : undefined;
};
const rpc = env("PROVIDER_RPC_URL");
const targets = env("PROVIDER_TARGET_ORIGIN");
const facilitator = env("PROVIDER_X402_FACILITATOR_URL");

const chain = rpc
  ? createPublicClient({ chain: baseSepolia, transport: http(rpc) })
  : undefined;
const x402 = facilitator
  ? new HTTPFacilitatorClient({ url: facilitator })
  : undefined;
const dataDir = env("PROVIDER_DATA_DIR") ?? ".provider-data";

await startFoundationService("provider", 3001, async (app) => {
  await registerProviderRoutes(app, {
    keys: {
      a: key("PROVIDER_A_PRIVATE_KEY"),
      b: key("PROVIDER_B_PRIVATE_KEY"),
    },
    store: new InvoiceStore(dataDir),
    chain,
    browser: targets
      ? {
          targetOrigin: targets,
          channel: env("PROVIDER_BROWSER_CHANNEL") ?? "chrome",
          executablePath: env("PROVIDER_BROWSER_PATH"),
        }
      : undefined,
    workerToken: env("PROVIDER_WORKER_TOKEN"),
    facilitator: x402,
    publicUrl: env("PROVIDER_PUBLIC_URL"),
  });
  await registerShopRoutes(app, {
    key: key("SHOP_PRIVATE_KEY"),
    store: new RecordStore<OrderRecord>(`${dataDir}/shop`),
    chain,
    facilitator: x402,
    workerToken: env("PROVIDER_WORKER_TOKEN"),
    publicUrl: env("PROVIDER_PUBLIC_URL"),
  });
});

import { startFoundationService } from "@mandate/platform";
import type { Hex } from "viem";
import { registerProviderRoutes } from "./routes.js";

const key = (name: string) => {
  const value = process.env[name];
  return value && /^0x[0-9a-fA-F]{64}$/.test(value)
    ? (value as Hex)
    : undefined;
};

await startFoundationService("provider", 3001, async (app) => {
  await registerProviderRoutes(app, {
    keys: {
      a: key("PROVIDER_A_PRIVATE_KEY"),
      b: key("PROVIDER_B_PRIVATE_KEY"),
    },
  });
});

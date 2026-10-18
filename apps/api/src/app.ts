import { createFoundationApp, type FoundationOptions } from "@mandate/platform";
import type { AuthConfig } from "./auth/config.js";
import { AuthService } from "./auth/service.js";
import { registerAuth } from "./auth/routes.js";

export type ApiOptions = FoundationOptions & {
  auth: AuthConfig | null;
  clock?: () => number;
};
export async function createApi(options: ApiOptions) {
  const app = createFoundationApp("api", options);
  const service =
    options.database && options.auth
      ? new AuthService(options.database, options.auth, options.clock)
      : null;
  await registerAuth(app, service);
  return app;
}

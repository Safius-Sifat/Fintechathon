import {
  createFoundationApp,
  systemClock,
  type FoundationOptions,
} from "@mandate/platform";
import type { AuthConfig } from "./auth/config.js";
import { AuthService } from "./auth/service.js";
import { registerAuth } from "./auth/routes.js";
import { registerBusiness } from "./business/routes.js";
import { AgenticService } from "./business/agentic.js";
import { ControlService } from "./business/controls.js";
import { TaskService } from "./business/tasks.js";
import {
  BusinessService,
  type BusinessDependencies,
} from "./business/service.js";

export type ApiOptions = FoundationOptions & {
  auth: AuthConfig | null;
  clock?: () => number;
  business?: BusinessDependencies;
};
export async function createApi(options: ApiOptions) {
  const app = createFoundationApp("api", options);
  const clock = options.clock ?? systemClock;
  const service =
    options.database && options.auth
      ? new AuthService(options.database, options.auth, clock)
      : null;
  await registerAuth(app, service);
  const deps = options.business ?? { chain: null };
  await registerBusiness(
    app,
    service && options.database
      ? new BusinessService(options.database, service, deps, clock)
      : null,
    options.database
      ? new AgenticService(
          options.database,
          clock,
          deps.intentCompiler ?? null,
          deps.manifest ?? null,
        )
      : null,
    options.database
      ? new ControlService(options.database, deps.chain?.client ?? null, clock)
      : null,
    options.database
      ? new TaskService(
          options.database,
          deps.chain?.client ?? null,
          deps.manifest ?? null,
          clock,
        )
      : null,
  );
  return app;
}

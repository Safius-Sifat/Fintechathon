import { startFoundationService } from "@mandate/platform";
import { registerProviderRoutes } from "./routes.js";

await startFoundationService("provider", 3001, async (app) => {
  await registerProviderRoutes(app);
});

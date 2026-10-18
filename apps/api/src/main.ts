import { startFoundationService } from "@mandate/platform";
import { loadAuthConfig } from "./auth/config.js";
import { registerAuth } from "./auth/routes.js";
import { AuthService } from "./auth/service.js";

await startFoundationService("api", 3000, async (app, database) => {
  let auth = null;
  try {
    auth = await loadAuthConfig(process.env);
  } catch {
    app.log.error(
      "Authentication configuration invalid; authentication disabled",
    );
  }
  await registerAuth(
    app,
    database && auth ? new AuthService(database, auth) : null,
  );
});

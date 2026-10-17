import { readFile, writeFile, access, mkdir } from "node:fs/promises";
import { randomBytes } from "node:crypto";
try {
  await access(".env");
  console.log(".env exists; preserved unchanged.");
} catch {
  const original = await readFile(".env.example", "utf8");
  const env = original
    .replace(
      /^POSTGRES_PASSWORD=$/m,
      "POSTGRES_PASSWORD=" + randomBytes(24).toString("hex"),
    )
    .replace(
      /^NATS_PASSWORD=$/m,
      "NATS_PASSWORD=" + randomBytes(24).toString("hex"),
    );
  await writeFile(".env", env, { mode: 0o600, flag: "wx" });
  console.log(
    "Created ignored .env with random local Postgres/NATS passwords. No wallet or signing keys generated.",
  );
}
await mkdir("artifacts-private", { recursive: true, mode: 0o700 });

import { randomUUID } from "node:crypto";
import type { Pool, PoolClient } from "pg";

// FCM/APNs delivery. The payload is only a kind and an ID; the app loads details
// over the authenticated API. Delivery never authorizes anything.
export type PushSender = (
  device: { platform: "android" | "ios"; pushToken: string },
  payload: { kind: "APPROVAL" | "ALERT"; id: string },
) => Promise<void>;

export async function notifyOwner(
  db: Pool | PoolClient,
  sender: PushSender | null,
  owner: string,
  kind: "APPROVAL" | "ALERT",
  referenceId: string,
  now: number,
): Promise<"SENT" | "UNSUPPORTED" | "FAILED" | "NO_DEVICE"> {
  const devices = (
    await db.query<{ platform: "android" | "ios"; push_token: string }>(
      "SELECT platform,push_token FROM push_devices WHERE owner_address=$1",
      [owner],
    )
  ).rows;
  let state: "SENT" | "UNSUPPORTED" | "FAILED" | "NO_DEVICE" = "NO_DEVICE";
  if (devices.length && !sender) state = "UNSUPPORTED";
  else if (devices.length && sender) {
    const results = await Promise.allSettled(
      devices.map((d) =>
        sender(
          { platform: d.platform, pushToken: d.push_token },
          { kind, id: referenceId },
        ),
      ),
    );
    state = results.some((r) => r.status === "fulfilled") ? "SENT" : "FAILED";
  }
  await db.query(
    "INSERT INTO push_deliveries(id,owner_address,kind,reference_id,state,created_at) VALUES($1,$2,$3,$4,$5,$6) ON CONFLICT DO NOTHING",
    [randomUUID(), owner, kind, referenceId, state, now],
  );
  return state;
}

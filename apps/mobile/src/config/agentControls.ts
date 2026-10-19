import type { AdminCommand } from "@mandate/schema";
import type { IconName } from "../components/Icon";
import type { Tone } from "../theme";

// The separate ways to stop or limit agents (plan S9.6, P3-A01, P3-W03).
// Freeze is a temporary stop that keeps permissions; pause and revoke end
// authority; logout only ends this phone's session with the service. On-
// chain controls take effect only when their transaction is confirmed.
// Command numbers are Person1's AdminCommand values (tested).

export type ControlId = "freeze" | "unfreeze" | "pause" | "revoke" | "logout";

export interface AgentControl {
  id: ControlId;
  command: (typeof AdminCommand)[keyof typeof AdminCommand] | null;
  title: string;
  effect: string;
  // What happens to the permissions the agent already has.
  afterwards: string;
  action: string;
  icon: IconName;
  tone: Tone;
  onChain: boolean;
  stopsAgentSpending: boolean;
  keepsPermissions: boolean;
}

export const CONTROLS: readonly AgentControl[] = [
  {
    id: "freeze",
    command: 5,
    title: "Freeze",
    effect:
      "Stops all agent spending at once. A temporary stop for when something looks wrong.",
    afterwards:
      "Permissions and their limits are kept. Their expiry times keep running.",
    action: "Freeze agent wallet",
    icon: "snowflake",
    tone: "blue",
    onChain: true,
    stopsAgentSpending: true,
    keepsPermissions: true,
  },
  {
    id: "unfreeze",
    command: 6,
    title: "Unfreeze",
    effect: "Lets agents spend again under the permissions they still have.",
    afterwards:
      "No new approval is needed for permissions that have not expired.",
    action: "Unfreeze agent wallet",
    icon: "snowflake-off",
    tone: "blue",
    onChain: true,
    stopsAgentSpending: false,
    keepsPermissions: true,
  },
  {
    id: "pause",
    command: 0,
    title: "Pause",
    effect: "Stops every agent and ends every permission they have.",
    afterwards:
      "All existing permissions stop working for good. Unpausing does not bring them back; each task needs a new approval.",
    action: "Pause agent wallet",
    icon: "pause-circle-outline",
    tone: "amber",
    onChain: true,
    stopsAgentSpending: true,
    keepsPermissions: false,
  },
  {
    id: "revoke",
    command: 2,
    title: "Revoke",
    effect: "Ends one task's permission. Other tasks keep running.",
    afterwards: "That permission stops working for good.",
    action: "Revoke a permission",
    icon: "close-octagon-outline",
    tone: "red",
    onChain: true,
    stopsAgentSpending: true,
    keepsPermissions: false,
  },
  {
    id: "logout",
    command: null,
    title: "Log out",
    effect:
      "Ends this phone's session with the Mandate service. Nothing changes on chain.",
    afterwards:
      "Agents keep working under the permissions you approved. To stop them, freeze, pause or revoke.",
    action: "Log out of the service",
    icon: "logout",
    tone: "slate",
    onChain: false,
    stopsAgentSpending: false,
    keepsPermissions: true,
  },
];

export function findControl(id: ControlId): AgentControl {
  const control = CONTROLS.find((c) => c.id === id);
  if (!control) throw new Error(`Unknown control ${id}`);
  return control;
}

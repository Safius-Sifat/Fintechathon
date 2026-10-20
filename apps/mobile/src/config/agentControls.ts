import type { AdminCommand } from "@mandate/schema";
import type { IconName } from "../components/Icon";
import type { Tone } from "../theme";

// The separate ways to stop or limit agents (plan S9.6, P3-A01, P3-W03).
// Freeze is a temporary stop that keeps permissions; pause and revoke end
// authority; logout only ends this phone's session with the service. On-
// chain controls take effect only when their transaction is confirmed.
// Command numbers are Person1's AdminCommand values (tested). Owner
// transfer is its own signed type (plan S8.3), so it has no Admin command.

export type ControlId =
  | "freeze"
  | "unfreeze"
  | "pause"
  | "unpause"
  | "revoke"
  | "recover"
  | "recoverLiquid"
  | "ownerTransfer"
  | "ownerSweep"
  | "logout";

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
    id: "unpause",
    command: 1,
    title: "Unpause",
    effect: "Lets the agent wallet accept new permissions again.",
    afterwards:
      "Permissions ended by a pause or recovery stay ended. Each task needs a new approval.",
    action: "Unpause agent wallet",
    icon: "play-circle-outline",
    tone: "amber",
    onChain: true,
    stopsAgentSpending: false,
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
    id: "recover",
    command: 3,
    title: "Recover",
    effect:
      "Tries to redeem the approved vault position, then sends DemoUSD to your owner address.",
    afterwards:
      "Pauses agents and ends every permission. If the vault cannot redeem, use Recover liquid instead.",
    action: "Recover to owner",
    icon: "backup-restore",
    tone: "red",
    onChain: true,
    stopsAgentSpending: true,
    keepsPermissions: false,
  },
  {
    id: "recoverLiquid",
    command: 4,
    title: "Recover liquid",
    effect:
      "Sends only liquid DemoUSD to your owner address, with no vault call.",
    afterwards:
      "Pauses agents and ends every permission. The vault position stays in the agent wallet.",
    action: "Recover liquid DemoUSD",
    icon: "cash-fast",
    tone: "red",
    onChain: true,
    stopsAgentSpending: true,
    keepsPermissions: false,
  },
  {
    id: "ownerTransfer",
    command: null,
    title: "Owner transfer",
    effect:
      "Moves one asset out of the agent wallet to a recipient you review and sign. One asset per transfer.",
    afterwards:
      "Once confirmed, each transfer pauses agents and ends every permission. Vault shares cannot be moved this way.",
    action: "Transfer from agent wallet",
    icon: "bank-transfer-out",
    tone: "red",
    onChain: true,
    stopsAgentSpending: true,
    keepsPermissions: false,
  },
  {
    // The recovery use of an owner transfer: the signed recipient is the
    // owner address.
    id: "ownerSweep",
    command: null,
    title: "Sweep to owner",
    effect:
      "An owner transfer whose recipient is your owner address. Moves one asset, such as ETH or an imported token, back to you.",
    afterwards:
      "Once confirmed, each sweep pauses agents and ends every permission. Vault shares cannot be moved this way.",
    action: "Sweep to owner",
    icon: "bank-transfer-in",
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

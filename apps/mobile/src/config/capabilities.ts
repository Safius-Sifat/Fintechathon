// The state of a capability this build depends on. A capability is only
// "configured" when the code behind it exists and works. Nothing is simulated.
export type CapabilityState =
  | "configured"
  | "notBuilt"
  | "notConnected"
  | "unavailable";

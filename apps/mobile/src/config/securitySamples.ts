import type { AgentScope } from "./securityAccess";

// Development samples for the Security screen, shown only in __DEV__ builds
// and always labelled. No session IDs, token values or secrets: just enough
// to review the list layout. Device names are whatever a device reported, so
// they are untrusted text, never proof of which phone it is.

export interface SampleSession {
  label: string;
  // Device names are reported by the device and never verified.
  labelTrusted: false;
  current: boolean;
  lastUsed: string;
}

export const SAMPLE_SESSIONS: readonly SampleSession[] = [
  {
    label: "Pixel test phone",
    labelTrusted: false,
    current: true,
    lastUsed: "Now",
  },
  {
    label: "Old test phone",
    labelTrusted: false,
    current: false,
    lastUsed: "3 days ago",
  },
];

export interface SampleAgentToken {
  name: string;
  scopes: readonly AgentScope[];
  limit: string;
  expires: string;
}

export const SAMPLE_AGENT_TOKENS: readonly SampleAgentToken[] = [
  {
    name: "Research assistant",
    scopes: ["read", "prepare"],
    limit: "This agent wallet",
    expires: "In 6 days",
  },
  {
    name: "Price check task",
    scopes: ["read", "run", "evidence"],
    limit: "One task",
    expires: "In 20 hours",
  },
];

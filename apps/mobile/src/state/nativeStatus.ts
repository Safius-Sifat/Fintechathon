import { getNativeStatus, type NativeStatus } from "@mandate/owner-wallet";
import { useEffect, useState } from "react";
import type { Capability } from "../config/capabilities";

export type NativeModuleState =
  | { kind: "checking" }
  | { kind: "missing" }
  | { kind: "ready"; status: NativeStatus }
  | { kind: "failed"; reason: string };

// Asks the native module once per mount. "ready" needs both the library load
// and Wallet Core's own computation to succeed on this device.
export function useNativeModuleState(): NativeModuleState {
  const [state, setState] = useState<NativeModuleState>({ kind: "checking" });

  useEffect(() => {
    let active = true;
    getNativeStatus().then(
      (status) => {
        if (active) setState(toState(status));
      },
      (error: unknown) => {
        if (active) setState({ kind: "failed", reason: String(error) });
      },
    );
    return () => {
      active = false;
    };
  }, []);

  return state;
}

function toState(status: NativeStatus | null): NativeModuleState {
  if (!status) return { kind: "missing" };
  if (!status.walletCoreLoaded) {
    return {
      kind: "failed",
      reason: status.error ?? "Wallet Core did not load",
    };
  }
  if (!status.keccakSelfTest) {
    return { kind: "failed", reason: "Wallet Core self-test failed" };
  }
  return { kind: "ready", status };
}

const BASE = {
  id: "native-module",
  title: "Native wallet module",
  icon: "chip",
  tone: "slate",
} as const;

export function nativeModuleCapability(state: NativeModuleState): Capability {
  switch (state.kind) {
    case "checking":
      return {
        ...BASE,
        detail: "Checking the native wallet library…",
        state: "notBuilt",
        stateLabel: "Checking",
      };
    case "missing":
      return {
        ...BASE,
        detail: "This app build does not include the native wallet module.",
        state: "unavailable",
        stateLabel: "Not in this build",
      };
    case "failed":
      return {
        ...BASE,
        detail: state.reason,
        state: "unavailable",
        stateLabel: "Failed",
      };
    case "ready":
      return {
        ...BASE,
        detail: `Wallet Core ${state.status.walletCoreVersion} loaded and passed its self-test. No keys exist yet.`,
        state: "configured",
        stateLabel: "Loaded",
      };
  }
}

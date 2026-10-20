import { useMemo, useSyncExternalStore } from "react";
import { network } from "../config/network";
import { useWallet } from "../wallet/session";
import {
  getDraft,
  subscribe,
  type DraftContext,
  type SendDraft,
} from "./sendDraft";

// The account and network the Send form belongs to. A draft never follows
// the user to another account.
export function useDraftContext(): DraftContext {
  const { profile } = useWallet();
  const address =
    profile?.accounts.find((a) => a.index === profile.current)?.address ?? null;
  return useMemo(
    () => ({ accountId: address, chainId: network.chainId }),
    [address],
  );
}

export function useSendDraft(context: DraftContext): SendDraft {
  return useSyncExternalStore(subscribe, () => getDraft(context));
}

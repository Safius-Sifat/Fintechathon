import { useSyncExternalStore } from "react";
import { network } from "../config/network";
import {
  getDraft,
  subscribe,
  type DraftContext,
  type SendDraft,
} from "./sendDraft";

// The account and network the Send form belongs to. No account exists on
// this phone yet; the native account state replaces this when it is built,
// and account switches call switchContext().
export const currentDraftContext: DraftContext = {
  accountId: null,
  chainId: network.chainId,
};

export function useSendDraft(context: DraftContext): SendDraft {
  return useSyncExternalStore(subscribe, () => getDraft(context));
}

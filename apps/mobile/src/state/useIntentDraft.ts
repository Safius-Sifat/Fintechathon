import { useSyncExternalStore } from "react";
import {
  getIntentDraft,
  subscribeIntentDrafts,
  type IntentState,
} from "./intentDraft";
import type { DraftContext } from "./sendDraft";

export function useIntentDraft(context: DraftContext): IntentState {
  return useSyncExternalStore(subscribeIntentDrafts, () =>
    getIntentDraft(context),
  );
}

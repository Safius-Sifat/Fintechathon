import { useSyncExternalStore } from "react";
import {
  getPolicyEditor,
  subscribePolicyForms,
  type PolicyEditor,
} from "./policyDraft";
import type { DraftContext } from "./sendDraft";

export function usePolicyEditor(context: DraftContext): PolicyEditor {
  return useSyncExternalStore(subscribePolicyForms, () =>
    getPolicyEditor(context),
  );
}

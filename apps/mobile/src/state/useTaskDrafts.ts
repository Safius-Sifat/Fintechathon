import { useSyncExternalStore } from "react";
import {
  getTaskDrafts,
  subscribeTaskDrafts,
  type TaskDrafts,
} from "./taskDraft";
import type { DraftContext } from "./sendDraft";

export function useTaskDrafts(context: DraftContext): TaskDrafts {
  return useSyncExternalStore(subscribeTaskDrafts, () =>
    getTaskDrafts(context),
  );
}

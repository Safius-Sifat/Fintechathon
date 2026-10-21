// Follows one chat with the agent from the service.
import { useCallback, useEffect, useState } from "react";
import type { Hex } from "viem";
import {
  conversationEvents,
  sendMessage,
  serviceSignedIn,
  streamConversation,
  type ChatEvent,
} from "../wallet/api";
import { errorText } from "../wallet/useAsync";
import { buildThread } from "./chatThread";

interface ChatState {
  events: ChatEvent[];
  live: string;
  replying: boolean;
  loading: boolean;
  // Why the chat cannot be read or followed live right now.
  error: string | null;
}

const RETRY_MS = [1000, 2000, 5000, 15000];

// Loads a chat, then follows it live, reconnecting from the last event when
// the stream drops. Closing the screen never stops the agent's work.
export function useConversation(id: string | null) {
  const [state, setState] = useState<ChatState>({
    events: [],
    live: "",
    replying: false,
    loading: !!id,
    error: null,
  });

  useEffect(() => {
    setState({
      events: [],
      live: "",
      replying: false,
      loading: !!id,
      error: null,
    });
    if (!id) return;
    let stopped = false;
    let last = 0;
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let close = () => {};

    const add = (event: ChatEvent) =>
      setState((s) => ({
        ...s,
        events: [...s.events, event],
        live: event.type === "agent" ? "" : s.live,
        replying:
          event.type === "user"
            ? true
            : event.type === "agent" || event.type === "error"
              ? false
              : s.replying,
      }));

    const connect = () => {
      close = streamConversation(
        id,
        last,
        (update) => {
          attempt = 0;
          if (update.kind === "event") {
            if (update.event.seq <= last) return;
            last = update.event.seq;
            add(update.event);
          } else if (update.kind === "text")
            setState((s) => ({ ...s, live: s.live + update.text }));
          else
            setState((s) => ({
              ...s,
              replying: update.replying,
              live: update.replying ? s.live : "",
              error: null,
            }));
        },
        (error) => {
          if (stopped || !error) return;
          if (!serviceSignedIn()) {
            setState((s) => ({ ...s, error: error.message }));
            return;
          }
          setState((s) => ({
            ...s,
            error: attempt > 1 ? "Reconnecting to the agent…" : s.error,
          }));
          timer = setTimeout(
            connect,
            RETRY_MS[Math.min(attempt++, RETRY_MS.length - 1)],
          );
        },
      );
    };

    (async () => {
      const events: ChatEvent[] = [];
      let replying = false;
      for (;;) {
        const page = await conversationEvents(id, last);
        events.push(...page.events);
        last = page.last;
        replying = page.replying;
        if (!page.full) break;
      }
      if (stopped) return;
      setState({ events, live: "", replying, loading: false, error: null });
      connect();
    })().catch((e) => {
      if (!stopped)
        setState((s) => ({ ...s, loading: false, error: errorText(e) }));
    });

    return () => {
      stopped = true;
      clearTimeout(timer);
      close();
    };
  }, [id]);

  const send = useCallback(
    async (text: string, deliveryHash: Hex | null) => {
      if (!id) return;
      setState((s) => ({ ...s, replying: true }));
      try {
        await sendMessage(id, text, deliveryHash);
      } catch (e) {
        setState((s) => ({ ...s, replying: false }));
        throw e;
      }
    },
    [id],
  );

  return {
    ...state,
    turns: buildThread(state.events, state.live, state.replying),
    send,
  };
}

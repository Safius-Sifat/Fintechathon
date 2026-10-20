import { useIsFocused } from "@react-navigation/native";
import { useCallback, useEffect, useRef, useState } from "react";
import { AppState } from "react-native";
import { useApiSession } from "../wallet/api";
import { errorText } from "../wallet/useAsync";

// Single in-flight read; hidden screens and background apps stop polling.
export function useServicePoll<T>(
  read: () => Promise<T>,
  identity: string,
  interval = 2000,
) {
  const api = useApiSession();
  const focused = useIsFocused();
  const [active, setActive] = useState(AppState.currentState === "active");
  const [tick, setTick] = useState(0);
  const [state, setState] = useState<{
    identity: string;
    data?: T;
    error: string | null;
    loading: boolean;
  }>({ identity, error: null, loading: true });
  const reader = useRef(read);
  reader.current = read;
  const key = `${api?.owner ?? ""}:${api?.sessionId ?? ""}:${identity}`;
  useEffect(() => {
    const sub = AppState.addEventListener("change", (s) =>
      setActive(s === "active"),
    );
    return () => sub.remove();
  }, []);
  useEffect(() => {
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (!api || !focused || !active) return;
    const run = async () => {
      setState((s) => ({
        identity: key,
        ...(s.identity === key ? { data: s.data } : {}),
        error: s.identity === key ? s.error : null,
        loading: true,
      }));
      try {
        const data = await reader.current();
        if (live)
          setState({ identity: key, data, error: null, loading: false });
      } catch (e) {
        if (live)
          setState((s) => ({
            ...s,
            identity: key,
            error: errorText(e),
            loading: false,
          }));
      }
      if (live && interval > 0) timer = setTimeout(run, interval);
    };
    void run();
    return () => {
      live = false;
      if (timer) clearTimeout(timer);
    };
  }, [key, focused, active, interval, tick]);
  const reload = useCallback(() => setTick((n) => n + 1), []);
  return {
    data: state.identity === key && api ? state.data : undefined,
    error: state.identity === key ? state.error : null,
    loading: state.identity !== key || state.loading,
    reload,
  };
}

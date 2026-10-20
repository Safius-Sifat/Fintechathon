import { useCallback, useEffect, useRef, useState } from "react";

export interface AsyncState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

// Dependency generations hide the previous account's data immediately.
export function useAsync<T>(
  run: () => Promise<T>,
  deps: readonly unknown[],
): AsyncState<T> {
  const identity = useRef({ deps, generation: 0 });
  if (
    identity.current.deps.length !== deps.length ||
    deps.some((d, i) => !Object.is(d, identity.current.deps[i]))
  )
    identity.current = { deps, generation: identity.current.generation + 1 };
  const generation = identity.current.generation;
  const [state, setState] = useState<{
    generation: number;
    data?: T;
    error: string | null;
    loading: boolean;
  }>({ generation, error: null, loading: true });
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({
      generation,
      ...(s.generation === generation ? { data: s.data } : {}),
      error: null,
      loading: true,
    }));
    run()
      .then((data) => {
        if (live) setState({ generation, data, error: null, loading: false });
      })
      .catch((e: unknown) => {
        if (live)
          setState((s) => ({
            ...s,
            generation,
            error: errorText(e),
            loading: false,
          }));
      });
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick]);
  const reload = useCallback(() => setTick((t) => t + 1), []);
  return state.generation === generation
    ? { data: state.data, error: state.error, loading: state.loading, reload }
    : { data: undefined, error: null, loading: true, reload };
}

export const errorText = (e: unknown) =>
  e instanceof Error ? e.message : String(e);

import { useEffect, useState } from "react";

type AsyncState<T> =
  | { status: "loading"; data?: undefined; error?: undefined }
  | { status: "success"; data: T; error?: undefined }
  | { status: "error"; data?: undefined; error: unknown };

type Settled<T> = { deps: unknown[]; state: AsyncState<T> };

const sameDeps = (a: unknown[], b: unknown[]) => a.length === b.length && a.every((dep, i) => Object.is(dep, b[i]));

/** Minimal loader for feature hooks until a data-fetching library is chosen. */
export function useAsync<T>(load: () => Promise<T>, deps: unknown[]): AsyncState<T> {
  const [settled, setSettled] = useState<Settled<T>>();

  useEffect(() => {
    let cancelled = false;
    load().then(
      (data) => !cancelled && setSettled({ deps, state: { status: "success", data } }),
      (error: unknown) => !cancelled && setSettled({ deps, state: { status: "error", error } }),
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  // A result for older deps is stale, so report loading until the current request settles.
  return settled && sameDeps(settled.deps, deps) ? settled.state : { status: "loading" };
}

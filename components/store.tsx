"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

// UI-only state shared across views (search text, filters). Anything that matters (accounts, carts, purchases) lives in Convex.
type State = {
  q: string;
  lvl: string;
  sort: string;
  mineTab: string;
};

const initial: State = { q: "", lvl: "All", sort: "new", mineTab: "All" };

type Store = State & { set: (patch: Partial<State>) => void };

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<State>(initial);
  const set = useCallback((patch: Partial<State>) => setS((p) => ({ ...p, ...patch })), []);
  const store = useMemo<Store>(() => ({ ...s, set }), [s, set]);
  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used within StoreProvider");
  return v;
}

"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";

// Mirrors the prototype's in-memory state (shared across all views).
type State = {
  q: string;
  lvl: string;
  sort: string;
    mineTab: string;
  cart: number[];
  wish: number[];
  owned: number[];
  done: Record<string, boolean>;
  coupon: boolean;
  paid: boolean;
  pay: string;
};

const initial: State = {
  q: "",
  lvl: "All",
  sort: "new",
    mineTab: "All",
  cart: [],
  wish: [],
  owned: [],
  done: {},
  coupon: false,
  paid: false,
  pay: "card",
};

type Store = State & {
  set: (patch: Partial<State>) => void;
  addToCart: (id: number) => void;
  removeFromCart: (id: number) => void;
  buyNow: (id: number) => void;
  toggleWish: (id: number) => void;
  toggleDone: (key: string) => void;
  toggleCoupon: () => void;
  resetPaid: () => void;
  checkout: () => void;
};

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [s, setS] = useState<State>(initial);

  const set = useCallback((patch: Partial<State>) => setS((p) => ({ ...p, ...patch })), []);
  const store = useMemo<Store>(
    () => ({
      ...s,
      set,
      addToCart: (id) => setS((p) => ({ ...p, cart: [...p.cart, id] })),
      removeFromCart: (id) => setS((p) => ({ ...p, cart: p.cart.filter((x) => x !== id) })),
      buyNow: (id) =>
        setS((p) => ({ ...p, cart: p.cart.includes(id) ? p.cart : [...p.cart, id], paid: false })),
      toggleWish: (id) =>
        setS((p) => ({
          ...p,
          wish: p.wish.includes(id) ? p.wish.filter((x) => x !== id) : [...p.wish, id],
        })),
      toggleDone: (key) => setS((p) => ({ ...p, done: { ...p.done, [key]: !p.done[key] } })),
      toggleCoupon: () => setS((p) => ({ ...p, coupon: !p.coupon })),
      resetPaid: () => setS((p) => ({ ...p, paid: false })),
      checkout: () =>
        setS((p) => ({ ...p, paid: true, owned: [...new Set([...p.owned, ...p.cart])], cart: [] })),
    }),
    [s, set],
  );

  return <Ctx.Provider value={store}>{children}</Ctx.Provider>;
}

export function useStore() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useStore must be used within StoreProvider");
  return v;
}

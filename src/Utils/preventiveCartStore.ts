import AsyncStorage from "@react-native-async-storage/async-storage";

export const CART_STORAGE_KEY = "preventive_cart_items_v1";

interface CartState {
  items: any[];
}

interface CartStore {
  getState: () => CartState;
  subscribe: (fn: (s: CartState) => void) => () => void;
  setItems: (items: any[]) => void;
  addItem: (item: any) => void;
  removeItem: (id: string) => void;
}

export function getPreventiveCartStore(): CartStore {
  const g = globalThis as any;

  if (g.__preventiveCart?.getState) return g.__preventiveCart as CartStore;

  let state: CartState = { items: [] };
  const listeners = new Set<(s: CartState) => void>();

  const emit = () => {
    listeners.forEach((fn) => fn(state));
  };

  const persist = (items: any[]) => {
    AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items)).catch(() => {});
  };

  const store: CartStore = {
    getState: () => state,

    subscribe: (fn: (s: CartState) => void) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },

    setItems: (items: any[]) => {
      state = { items: items || [] };
      emit();
      persist(state.items);
    },

    addItem: (item: any) => {
      const exists = state.items.find((x) => x.id === item.id);
      if (exists) return;

      const next = [...state.items, item];
      state = { items: next };
      emit();
      persist(next);
    },

    removeItem: (id: string) => {
      const next = state.items.filter((x) => x.id !== id);
      state = { items: next };
      emit();
      persist(next);
    },
  };

  g.__preventiveCart = store;

  // Hydrate from AsyncStorage once on first access
  AsyncStorage.getItem(CART_STORAGE_KEY)
    .then((raw) => {
      if (raw) store.setItems(JSON.parse(raw));
    })
    .catch(() => {});

  return store;
}

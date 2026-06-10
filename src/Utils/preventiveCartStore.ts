import AsyncStorage from '@react-native-async-storage/async-storage';
import { store } from '../store';
import {
  addCartItem,
  removeCartItem,
  setCartItems,
  type CartItem,
} from '../features/cart/cartSlice';

export const CART_STORAGE_KEY = 'preventive_cart_items_v1';

interface CartState {
  items: CartItem[];
}

interface CartStore {
  getState: () => CartState;
  subscribe: (fn: (s: CartState) => void) => () => void;
  setItems: (items: CartItem[]) => void;
  addItem: (item: CartItem) => void;
  removeItem: (id: string) => void;
}

let hydrated = false;

function hydrateOnce() {
  if (hydrated) {
    return;
  }
  hydrated = true;
  AsyncStorage.getItem(CART_STORAGE_KEY)
    .then(raw => {
      if (raw) {
        const items = JSON.parse(raw) as CartItem[];
        store.dispatch(setCartItems(items));
      }
    })
    .catch(() => {});
}

export function getPreventiveCartStore(): CartStore {
  hydrateOnce();

  return {
    getState: () => ({ items: store.getState().cart.items }),

    subscribe: (fn: (s: CartState) => void) => {
      let prev = store.getState().cart.items;
      return store.subscribe(() => {
        const next = store.getState().cart.items;
        if (next !== prev) {
          prev = next;
          fn({ items: next });
        }
      });
    },

    setItems: (items: CartItem[]) => {
      store.dispatch(setCartItems(items ?? []));
      AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items ?? [])).catch(() => {});
    },

    addItem: (item: CartItem) => {
      store.dispatch(addCartItem(item));
      const next = store.getState().cart.items;
      AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    },

    removeItem: (id: string) => {
      store.dispatch(removeCartItem(id));
      const next = store.getState().cart.items;
      AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(next)).catch(() => {});
    },
  };
}

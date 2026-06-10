import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export type CartItem = Record<string, unknown> & { id: string };

export type CartState = {
  items: CartItem[];
};

const initialState: CartState = {
  items: [],
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    setCartItems: (state, action: PayloadAction<CartItem[]>) => {
      state.items = action.payload ?? [];
    },
    addCartItem: (state, action: PayloadAction<CartItem>) => {
      const exists = state.items.find(x => x.id === action.payload.id);
      if (!exists) {
        state.items.push(action.payload);
      }
    },
    removeCartItem: (state, action: PayloadAction<string>) => {
      state.items = state.items.filter(x => x.id !== action.payload);
    },
    clearCart: () => initialState,
  },
});

export const { setCartItems, addCartItem, removeCartItem, clearCart } = cartSlice.actions;
export default cartSlice.reducer;

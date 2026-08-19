import { computed, effect, Injectable, signal } from '@angular/core';
import { CartItem, RecipeModel } from './models';

const CART_STORAGE_KEY = 'cart_items';
// Giới hạn số lượng đặt tối đa cho mỗi món trong giỏ — khớp với giới hạn phía backend.
export const MAX_QUANTITY_PER_ITEM = 50;

export interface DeliveryInfo {
  recipientName: string;
  phone: string;
  address: string;
  note?: string;
}

function readStoredCart(): CartItem[] {
  try {
    const raw = localStorage.getItem(CART_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as CartItem[]) : [];
  } catch {
    return [];
  }
}

@Injectable({ providedIn: 'root' })
export class CartService {
  readonly items = signal<CartItem[]>(readStoredCart());

  readonly totalCount = computed(() =>
    this.items().reduce((sum, item) => sum + item.quantity, 0),
  );
  readonly totalPrice = computed(() =>
    this.items().reduce((sum, item) => sum + item.price * item.quantity, 0),
  );

  constructor() {
    effect(() => {
      localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(this.items()));
    });
  }

  addItem(recipe: RecipeModel, quantity = 1): void {
    this.items.update((items) => {
      const existing = items.find((item) => item.recipeId === recipe.id);
      if (existing) {
        return items.map((item) =>
          item.recipeId === recipe.id
            ? { ...item, quantity: Math.min(item.quantity + quantity, MAX_QUANTITY_PER_ITEM) }
            : item,
        );
      }
      return [
        ...items,
        {
          recipeId: recipe.id,
          name: recipe.name,
          price: recipe.price,
          imgUrl: recipe.imgUrl,
          quantity: Math.min(quantity, MAX_QUANTITY_PER_ITEM),
        },
      ];
    });
  }

  updateQuantity(recipeId: number, quantity: number): void {
    if (quantity <= 0) {
      this.removeItem(recipeId);
      return;
    }
    const cappedQuantity = Math.min(quantity, MAX_QUANTITY_PER_ITEM);
    this.items.update((items) =>
      items.map((item) => (item.recipeId === recipeId ? { ...item, quantity: cappedQuantity } : item)),
    );
  }

  removeItem(recipeId: number): void {
    this.items.update((items) => items.filter((item) => item.recipeId !== recipeId));
  }

  clear(): void {
    this.items.set([]);
  }
}

import { Component, computed, signal, inject } from '@angular/core';
import { RecipeModel } from '../models';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { RECIPES_API_URL, RecipeService } from '../recipe-service';
import { OrderService } from '../order-service';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { httpResource } from '@angular/common/http';
import { AuthService } from '../auth-service';
import { CartService } from '../cart-service';
import { resolveImageUrl } from '../api-config';
import { BackLink } from '../back-link/back-link';

const MAX_SO_PHAN_AN = 50;

// Số món liên quan hiển thị ở "Có thể bạn cũng thích".
const RELATED_COUNT = 4;

@Component({
  selector: 'app-recipe-detail',
  imports: [RouterLink, MatButtonModule, MatIconModule, BackLink],
  templateUrl: './recipe-detail.html',
  styleUrl: './recipe-detail.css',
})
export class RecipeDetail {
  protected readonly auth = inject(AuthService);
  protected readonly cart = inject(CartService);
  protected readonly recipeService = inject(RecipeService);
  private readonly orderService = inject(OrderService);
  protected readonly maxSoPhanAn = MAX_SO_PHAN_AN;
  protected readonly resolveImageUrl = resolveImageUrl;

  // Mã số hiển thị cho khách = vị trí món trong thực đơn (1, 2, 3...) — KHÔNG phải id lưu trong
  // DB (id thật có thể có khoảng trống do món cũ đã bị xoá, gây khó hiểu cho người xem).
  protected readonly menuNumber = computed(() => {
    const recipe = this.selectedRecipe();
    if (!recipe) {
      return null;
    }
    const index = this.recipeService.recipes().findIndex((r) => r.id === recipe.id);
    return index >= 0 ? index + 1 : null;
  });

  protected readonly addedMessage = signal(false);

  protected readonly soPhanAn = signal(1);
  protected readonly adjustedIngredients = computed(() => {
    const recipe = this.selectedRecipe();
    if (!recipe) {
      return [];
    }
    const soPhanAn = this.soPhanAn();
    return recipe.ingredients.map((ingredient) => {
      return {
        name: ingredient.name,
        quantity: ingredient.quantity * soPhanAn,
        unit: ingredient.unit,
      };
    });
  });

  protected tangSoPhanAn(): void {
    if (this.soPhanAn() >= MAX_SO_PHAN_AN) {
      return;
    }
    this.soPhanAn.update((soPhanAnHienTai) => soPhanAnHienTai + 1);
  }
  protected giamSoPhanAn(): void {
    if (this.soPhanAn() === 0) {
      return;
    }
    this.soPhanAn.update((soPhanAnHienTai) => soPhanAnHienTai - 1);
  }

  private readonly route = inject(ActivatedRoute);
  private readonly params = toSignal(this.route.paramMap);

  // Lấy công thức trực tiếp theo id từ backend NestJS — không còn dò/gọi TheMealDB nữa.
  private readonly recipeResource = httpResource<RecipeModel>(() => {
    const idParam = this.params()?.get('id');
    return idParam ? `${RECIPES_API_URL}/${idParam}` : undefined;
  });
  protected readonly selectedRecipe = computed(() => this.recipeResource.value());

  // Số lượt đặt món này — dùng lại đúng API /orders/popularity đã có (RecipeList dùng để sắp xếp
  // "Phổ biến nhất"), hiển thị như 1 chỉ số thật thay cho "loại món"/"thời gian chế biến" vốn chưa
  // tồn tại trong dữ liệu công thức hiện có.
  private readonly popularity = signal<Record<number, number>>({});
  protected readonly orderCount = computed(() => {
    const recipe = this.selectedRecipe();
    return recipe ? (this.popularity()[recipe.id] ?? 0) : 0;
  });

  // "Có thể bạn cũng thích": lấy các món khác trong cùng thực đơn (loại trừ món đang xem), tối đa
  // RELATED_COUNT món — toàn bộ đều là món có thật, không gợi ý theo cá nhân hoá.
  protected readonly relatedRecipes = computed(() => {
    const current = this.selectedRecipe();
    if (!current) {
      return [];
    }
    return this.recipeService
      .recipes()
      .filter((r) => r.id !== current.id)
      .slice(0, RELATED_COUNT);
  });

  // Món yêu thích CÁ NHÂN (nút hình trái tim) — lưu cục bộ theo tài khoản qua localStorage, cùng cơ
  // chế và cùng key với trang thực đơn (my_favorite_recipes_<username>) để 2 trang luôn đồng bộ.
  private get myFavoritesKey(): string {
    const username = this.auth.currentUser()?.username ?? 'khach';
    return `my_favorite_recipes_${username}`;
  }

  protected readonly myFavoriteIds = signal<Set<number>>(this.loadMyFavoriteIds());

  constructor() {
    this.orderService
      .getPopularity()
      .then((counts) => this.popularity.set(counts))
      .catch(() => this.popularity.set({}));
  }

  private loadMyFavoriteIds(): Set<number> {
    try {
      const raw = localStorage.getItem(this.myFavoritesKey);
      return raw ? new Set(JSON.parse(raw) as number[]) : new Set<number>();
    } catch {
      return new Set<number>();
    }
  }

  protected toggleMyFavorite(event: Event, recipeId: number): void {
    event.preventDefault();
    event.stopPropagation();
    const next = new Set(this.myFavoriteIds());
    if (next.has(recipeId)) {
      next.delete(recipeId);
    } else {
      next.add(recipeId);
    }
    this.myFavoriteIds.set(next);
    localStorage.setItem(this.myFavoritesKey, JSON.stringify([...next]));
  }

  protected formatPrice(value: number): string {
    return value.toLocaleString('vi-VN') + 'đ';
  }

  protected themVaoGioHang(): void {
    const recipe = this.selectedRecipe();
    if (!recipe) {
      return;
    }
    this.cart.addItem(recipe, Math.max(this.soPhanAn(), 1));
    this.addedMessage.set(true);
    setTimeout(() => this.addedMessage.set(false), 2000);
  }
}

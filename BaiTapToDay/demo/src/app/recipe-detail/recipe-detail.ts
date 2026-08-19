import { Component, computed, signal, inject } from '@angular/core';
import { RecipeModel } from '../models';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { RECIPES_API_URL, RecipeService } from '../recipe-service';
import { MatButtonModule } from '@angular/material/button';
import { MatListModule } from '@angular/material/list';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { httpResource } from '@angular/common/http';
import { AuthService } from '../auth-service';
import { CartService } from '../cart-service';

const MAX_SO_PHAN_AN = 50;

@Component({
  selector: 'app-recipe-detail',
  imports: [RouterLink, MatButtonModule, MatListModule, MatCardModule, MatIconModule],
  templateUrl: './recipe-detail.html',
  styleUrl: './recipe-detail.css',
})
export class RecipeDetail {
  protected readonly auth = inject(AuthService);
  protected readonly cart = inject(CartService);
  protected readonly recipeService = inject(RecipeService);
  protected readonly maxSoPhanAn = MAX_SO_PHAN_AN;

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

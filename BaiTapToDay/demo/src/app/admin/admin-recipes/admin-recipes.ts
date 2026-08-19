import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';

import { RecipeModel } from '../../models';
import { RECIPES_API_URL, RecipeService } from '../../recipe-service';
import { ConfirmDialog } from '../../confirm-dialog/confirm-dialog';
import { AdminNav } from '../admin-nav/admin-nav';

// Trang CRUD công thức dành RIÊNG cho quản trị (bảng dữ liệu dày đặc thông tin, tông màu than
// chì) — KHÔNG tái sử dụng giao diện dạng lưới ảnh của RecipeList (trang khách), đúng yêu cầu đề
// bài. Form tạo/sửa vẫn tái dùng component AddRecipe hiện có (đã admin-gated từ trước) qua route
// /admin/recipes/new và /admin/recipes/:id/edit — chỉ danh sách/bảng là component mới.
@Component({
  selector: 'app-admin-recipes',
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    AdminNav,
  ],
  templateUrl: './admin-recipes.html',
  styleUrl: './admin-recipes.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminRecipesPage implements OnInit {
  private readonly http = inject(HttpClient);
  private readonly recipeService = inject(RecipeService);
  private readonly dialog = inject(MatDialog);

  protected readonly keyword = signal('');
  protected readonly recipes = signal<RecipeModel[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');
  protected readonly deletingId = signal<number | null>(null);

  ngOnInit(): void {
    this.loadRecipes();
  }

  protected async loadRecipes(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const trimmed = this.keyword().trim();
      const url = trimmed ? `${RECIPES_API_URL}?keyword=${encodeURIComponent(trimmed)}` : RECIPES_API_URL;
      this.recipes.set(await firstValueFrom(this.http.get<RecipeModel[]>(url)));
    } catch {
      this.errorMessage.set('Không tải được danh sách công thức, vui lòng thử lại.');
    } finally {
      this.loading.set(false);
    }
  }

  protected formatPrice(value: number): string {
    return value.toLocaleString('vi-VN') + 'đ';
  }

  protected async deleteRecipe(recipe: RecipeModel): Promise<void> {
    const dialogRef = this.dialog.open(ConfirmDialog, {
      panelClass: 'brand-dialog-panel',
      data: {
        title: 'Xóa công thức',
        message: `Bạn có chắc muốn xóa món "${recipe.name}" này chứ? Hành động này không thể hoàn tác.`,
        confirmText: 'Xóa',
        danger: true,
      },
    });
    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) {
      return;
    }

    this.deletingId.set(recipe.id);
    try {
      await this.recipeService.deleteRecipe(recipe.id);
      this.recipes.update((list) => list.filter((r) => r.id !== recipe.id));
    } catch {
      this.errorMessage.set('Xóa công thức thất bại, vui lòng thử lại.');
    } finally {
      this.deletingId.set(null);
    }
  }
}

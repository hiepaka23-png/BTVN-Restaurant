import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { RecipeService } from '../recipe-service';
import { RecipeModel } from '../models';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { form, submit, FormField, email, required, minLength, maxLength, min } from '@angular/forms/signals';
import { MatDialog } from '@angular/material/dialog';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';

const BACKEND_ORIGIN = 'http://localhost:3000';
const UPLOAD_IMAGE_API_URL = `${BACKEND_ORIGIN}/uploads/image`;
const DEFAULT_IMG_URL = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600';
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;


@Component({
  selector: 'app-add-recipe',
  standalone: true,
  imports: [

    CommonModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatIconModule,
    MatCardModule,
    FormField,

  ],
  templateUrl: './add-recipe.html',
  styleUrl: './add-recipe.css',
})
export class AddRecipe implements OnInit {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly recipeService = inject(RecipeService);
  private readonly dialog = inject(MatDialog);
  private readonly http = inject(HttpClient);

  // Khác null khi đang ở chế độ sửa (route /admin/recipes/:id/edit) — dùng để biết gọi update hay create.
  protected readonly editingId = signal<number | null>(null);
  private existingRecipe: RecipeModel | null = null;

  // Form này chỉ được vào qua /admin/recipes/new|:id/edit (AD-09 — không còn route công khai
  // /recipes/new|:id/edit nữa) — route data 'returnTo' luôn trỏ về danh sách quản trị.
  protected readonly returnPath = signal<string>(
    (this.route.snapshot.data['returnTo'] as string | undefined) ?? '/admin/recipes',
  );

  // Ảnh món ăn tải từ máy — imagePreviewUrl hiện thumbnail (ảnh cũ hoặc ảnh mới chọn),
  // selectedImageFile chỉ được gửi lên server khi bấm Lưu.
  protected readonly imagePreviewUrl = signal<string | null>(null);
  protected readonly imageError = signal('');
  protected readonly uploadingImage = signal(false);
  private selectedImageFile: File | null = null;

  protected readonly recipeModel = signal({
    name: '',
    description: '',
    authorEmail: '',
    price: 0,
  });
  protected readonly recipeForm = form(this.recipeModel, ((path) => {
    required(path.name, { message: 'Tên món không được để trống' });
    minLength(path.name, 3, { message: 'Tên phải có ít nhất 3 ký tự' });
    required(path.description, { message: 'Mô tả không được để trống' });
    minLength(path.description, 10, { message: 'Mô tả phải có ít nhất 10 ký tự' });
    required(path.authorEmail, { message: 'Email không được để trống' });
    email(path.authorEmail, { message: 'Email phải đúng định dạng' });
    min(path.price, 1000, { message: 'Giá phải từ 1.000đ trở lên' });
  }));


  nguyenLieuList: { ten: string; soLuong: number | null; donVi: string }[] = [
    { ten: '', soLuong: null, donVi: '' }
  ];

  async ngOnInit(): Promise<void> {
    const idParam = this.route.snapshot.paramMap.get('id');
    if (!idParam) {
      return;
    }
    const id = Number(idParam);
    const existing = await this.recipeService.getRecipeById(id);
    if (!existing) {
      return;
    }

    this.editingId.set(id);
    this.existingRecipe = existing;
    this.imagePreviewUrl.set(existing.imgUrl || null);
    this.recipeModel.set({
      name: existing.name,
      description: existing.description,
      authorEmail: existing.authorEmail,
      price: existing.price,
    });
    this.nguyenLieuList = existing.ingredients.length
      ? existing.ingredients.map((ingredient) => ({
          ten: ingredient.name,
          soLuong: ingredient.quantity,
          donVi: ingredient.unit,
        }))
      : this.nguyenLieuList;
  }

  protected onImageSelected(event: Event): void {
    this.imageError.set('');
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.imageError.set('Chỉ chấp nhận file ảnh (JPG, PNG, WEBP, GIF)');
      input.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      this.imageError.set('Kích thước ảnh tối đa 5MB');
      input.value = '';
      return;
    }

    this.selectedImageFile = file;
    this.imagePreviewUrl.set(URL.createObjectURL(file));
  }

  private async uploadImageIfNeeded(): Promise<string | undefined> {
    if (!this.selectedImageFile) {
      return undefined;
    }
    this.uploadingImage.set(true);
    try {
      const formData = new FormData();
      formData.append('file', this.selectedImageFile);
      const res = await firstValueFrom(
        this.http.post<{ url: string }>(UPLOAD_IMAGE_API_URL, formData),
      );
      return `${BACKEND_ORIGIN}${res.url}`;
    } finally {
      this.uploadingImage.set(false);
    }
  }

  themNguyenLieu() {
    this.nguyenLieuList.push({ ten: '', soLuong: null, donVi: '' });
  }

  xoaNguyenLieu(index: number) {
    this.nguyenLieuList.splice(index, 1);
  }

  private async confirmSave(): Promise<boolean> {
    const isEditing = this.editingId() !== null;
    const dialogRef = this.dialog.open(ConfirmDialog, {
      panelClass: 'brand-dialog-panel',
      data: {
        title: isEditing ? 'Cập nhật công thức' : 'Lưu công thức',
        message: isEditing
          ? 'Bạn có chắc muốn lưu các thay đổi cho công thức này không?'
          : 'Bạn có chắc muốn lưu công thức món ăn mới này không?',
        confirmText: 'Lưu',
      },
    });
    return (await firstValueFrom(dialogRef.afterClosed())) ?? false;
  }

  protected async save(event: Event): Promise<void> {
    event.preventDefault();
    let didSave = false;

    const ok = await submit(this.recipeForm, async () => {
      const confirmed = await this.confirmSave();
      if (!confirmed) {
        return;
      }

      let uploadedImgUrl: string | undefined;
      try {
        uploadedImgUrl = await this.uploadImageIfNeeded();
      } catch (error: any) {
        this.imageError.set(error?.error?.message || 'Tải ảnh lên thất bại, vui lòng thử lại.');
        return;
      }

      const { name, description, authorEmail, price } = this.recipeModel();

      const validIngredients = this.nguyenLieuList
        .filter((item) => item.ten.trim() !== '')
        .map((item) => ({
          name: item.ten.trim(),
          quantity: item.soLuong ?? 0,
          unit: item.donVi.trim(),
        }));

      const payload: Omit<RecipeModel, 'id'> = {
        name: name.trim(),
        description: description.trim(),
        authorEmail: authorEmail.trim(),
        price,
        ingredients: validIngredients,
        isFavorite: this.existingRecipe?.isFavorite ?? false,
        imgUrl: uploadedImgUrl ?? this.existingRecipe?.imgUrl ?? DEFAULT_IMG_URL,
      };

      const id = this.editingId();
      const saved = id !== null
        ? await this.recipeService.updateRecipe(id, payload)
        : await this.recipeService.addRecipe(payload);

      didSave = true;
      console.log(id !== null ? 'Đã cập nhật món:' : 'Đã thêm món:', saved);
    });
    if (ok && didSave) {
      await this.router.navigate([this.returnPath()]);
    }
  }
}
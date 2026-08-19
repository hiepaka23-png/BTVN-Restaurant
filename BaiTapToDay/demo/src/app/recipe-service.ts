import { computed, inject, Injectable, signal } from '@angular/core';
import { RecipeModel } from './models';
import { httpResource, HttpClient } from '@angular/common/http';
import { toSignal, toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, firstValueFrom, map } from 'rxjs';

// Backend NestJS — CRUD thật, dữ liệu lưu tạm ở service layer (xem RecipesService).
// Tìm kiếm món ăn cũng do NestJS xử lý (GET /recipes?keyword=...) — không còn gọi TheMealDB nữa.
export const RECIPES_API_URL = 'http://localhost:3000/recipes';

// Số ký tự tối thiểu trước khi thật sự gọi API tìm kiếm — tránh gọi backend ngay ký tự đầu tiên
// (kết quả gần như vô nghĩa, tốn request) khi người dùng chỉ mới bắt đầu gõ.
const MIN_SEARCH_LENGTH = 2;

@Injectable({
  providedIn: 'root',
})
export class RecipeService {
  private readonly http = inject(HttpClient);

  readonly keyword = signal<string>('');

  private readonly debouncedKeyword = toSignal(
    toObservable(this.keyword).pipe(
      debounceTime(400), // ⏱️ Đợi 400ms sau khi ngừng gõ mới gọi API
      map((k) => k.trim()), // 🧹 Chuẩn hóa chuỗi
      distinctUntilChanged(), // 🛑 Bỏ qua nếu từ khóa giống hệt lần tìm trước
    ),
    { initialValue: '' }
  );

  // Danh sách công thức — lọc theo từ khóa thật sự chạy trên backend NestJS (RecipesService.findAll).
  // Từ khóa rỗng/toàn khoảng trắng hoặc chưa đủ MIN_SEARCH_LENGTH ký tự -> không gọi API tìm kiếm,
  // trả về danh sách không lọc thay vào đó.
  private readonly recipesResource = httpResource<RecipeModel[]>(() => {
    const keyword = this.debouncedKeyword();
    return keyword.length >= MIN_SEARCH_LENGTH
      ? `${RECIPES_API_URL}?keyword=${encodeURIComponent(keyword)}`
      : RECIPES_API_URL;
  });
  readonly recipes = computed<RecipeModel[]>(() => this.recipesResource.value() ?? []);
  readonly isLoading = this.recipesResource.isLoading;

  async getRecipeById(id: number): Promise<RecipeModel | undefined> {
    try {
      return await firstValueFrom(this.http.get<RecipeModel>(`${RECIPES_API_URL}/${id}`));
    } catch {
      return undefined;
    }
  }

  async addRecipe(newRecipe: Omit<RecipeModel, 'id'>): Promise<RecipeModel> {
    const created = await firstValueFrom(this.http.post<RecipeModel>(RECIPES_API_URL, newRecipe));
    this.recipesResource.reload();
    return created;
  }

  async updateRecipe(id: number, changes: Partial<Omit<RecipeModel, 'id'>>): Promise<RecipeModel> {
    const updated = await firstValueFrom(
      this.http.patch<RecipeModel>(`${RECIPES_API_URL}/${id}`, changes),
    );
    this.recipesResource.reload();
    return updated;
  }

  async deleteRecipe(id: number): Promise<void> {
    await firstValueFrom(this.http.delete<void>(`${RECIPES_API_URL}/${id}`));
    this.recipesResource.reload();
  }
}

import { Component, computed, signal, inject, OnDestroy } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RecipeService } from '../recipe-service';
import { OrderService } from '../order-service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { RecipeStore } from '../add-recipe/recipe-store';
import { resolveImageUrl } from '../api-config';
import { AuthService } from '../auth-service';
import type { RecipeCategory } from '../models';

// Pill danh mục — 'all' = tất cả, 'special' tái dùng cờ isFavorite có sẵn (món do nhà hàng chọn
// nổi bật) thay vì thêm 1 category "Đặc biệt" trùng ý nghĩa với field đã có.
type CategoryFilter = 'all' | RecipeCategory | 'special';

interface CategoryPill {
  value: CategoryFilter;
  label: string;
  icon: string;
}

const CATEGORY_PILLS: CategoryPill[] = [
  { value: 'all', label: 'Tất cả', icon: 'apps' },
  { value: 'Món chính', label: 'Món chính', icon: 'restaurant_menu' },
  { value: 'Khai vị', label: 'Khai vị', icon: 'tapas' },
  { value: 'Súp & Salad', label: 'Súp & Salad', icon: 'soup_kitchen' },
  { value: 'Đồ uống', label: 'Đồ uống', icon: 'local_cafe' },
  { value: 'Tráng miệng', label: 'Tráng miệng', icon: 'icecream' },
  { value: 'special', label: 'Đặc biệt', icon: 'star' },
];

type SortOption = 'default' | 'name-asc' | 'name-desc' | 'price-asc' | 'price-desc' | 'popular';

interface SortMenuItem {
  value: SortOption;
  label: string;
  icon: string;
}

const SORT_MENU_ITEMS: SortMenuItem[] = [
  { value: 'default', label: 'Mặc định', icon: 'apps' },
  { value: 'name-asc', label: 'Tên A → Z', icon: 'sort_by_alpha' },
  { value: 'name-desc', label: 'Tên Z → A', icon: 'sort_by_alpha' },
  { value: 'price-asc', label: 'Giá thấp → cao', icon: 'trending_up' },
  { value: 'price-desc', label: 'Giá cao → thấp', icon: 'trending_down' },
  { value: 'popular', label: 'Phổ biến nhất', icon: 'local_fire_department' },
];

@Component({
  selector: 'app-recipe-list',
  imports: [FormsModule, RouterLink, MatIconModule, MatMenuModule, MatDividerModule, NgTemplateOutlet],
  templateUrl: './recipe-list.html',
  styleUrl: './recipe-list.css',
})
export class RecipeList implements OnDestroy {
  private readonly recipeService = inject(RecipeService);
  private readonly orderService = inject(OrderService);
  private readonly auth = inject(AuthService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  protected readonly recipes = this.recipeService.recipes;
  protected readonly store = inject(RecipeStore);

  protected readonly categoryPills = CATEGORY_PILLS;
  protected readonly sortMenuItems = SORT_MENU_ITEMS;
  protected readonly resolveImageUrl = resolveImageUrl;
  protected readonly activeCategory = signal<CategoryFilter>('all');
  protected readonly sortOption = signal<SortOption>('default');

  // Đồng bộ 2 chiều với query param ?favorite=true — cho phép mục "Yêu thích" ở sidebar (điều
  // hướng bằng URL) và pill trên chính trang này (điều hướng bằng click) cùng trỏ vào 1 trạng thái.
  protected readonly favoriteOnly = toSignal(
    this.route.queryParamMap.pipe(map((params) => params.get('favorite') === 'true')),
    { initialValue: this.route.snapshot.queryParamMap.get('favorite') === 'true' },
  );

  // Bấm 1 pill danh mục sẽ tự thoát chế độ "chỉ xem yêu thích" — 2 kiểu lọc này loại trừ nhau.
  protected readonly activePill = computed<CategoryFilter>(() =>
    this.favoriteOnly() ? 'all' : this.activeCategory(),
  );

  // Nút "Bộ lọc" đổi màu khi đang áp dụng sắp xếp khác mặc định hoặc đang xem riêng món yêu thích,
  // để người dùng biết có bộ lọc đang bật dù đã thu gọn vào menu.
  protected readonly isSortActive = computed(() => this.sortOption() !== 'default' || this.favoriteOnly());

  // Món yêu thích CÁ NHÂN (nút hình trái tim trên từng thẻ) — lưu cục bộ theo tài khoản qua
  // localStorage, khác với cờ isFavorite (do admin chọn món "đặc biệt" nổi bật trên toàn hệ thống).
  private get myFavoritesKey(): string {
    const username = this.auth.currentUser()?.username ?? 'khach';
    return `my_favorite_recipes_${username}`;
  }

  protected readonly myFavoriteIds = signal<Set<number>>(this.loadMyFavoriteIds());

  // Số lượt đặt theo recipeId — tải một lần khi vào trang, dùng cho lựa chọn "Phổ biến nhất".
  private readonly popularity = signal<Record<number, number>>({});

  // Toàn bộ món "đặc biệt" (isFavorite) để xoay vòng ở khu vực hero kiểu banner quảng cáo — nếu
  // chưa có món nào được đánh dấu thì tạm lấy món đầu tiên trong danh sách (không để trống hero).
  protected readonly featuredRecipes = computed(() => {
    const list = this.store.recipes();
    const specials = list.filter((r) => r.isFavorite);
    return specials.length > 0 ? specials : list.slice(0, 1);
  });

  // Kỹ thuật "băng chuyền 2 khe" để trượt CHẬM từ trái qua phải thay vì mờ dần/xuất hiện đột ngột:
  // khe trái (slotNext) luôn giữ sẵn món SẮP hiện, nằm ngoài khung hình bên trái; khe phải
  // (slotCurrent) là món đang hiển thị. Khi chuyển: bật .shifting để track trượt sang phải trong
  // SLIDE_MS (khe trái trượt vào giữa, khe phải trượt ra khỏi mép phải) — dừng lại đúng SLIDE_MS đó
  // rồi mới đổi dữ liệu và bật .instant để "nhảy" ngay lập tức về vị trí nghỉ (không animation, vì
  // nội dung lúc đó giống hệt cái vừa trượt vào nên mắt không nhận ra cú nhảy).
  protected readonly currentIndex = signal(0);
  protected readonly nextIndex = signal(1);
  protected readonly shifting = signal(false);
  protected readonly trackInstant = signal(true);

  protected readonly slotCurrentRecipe = computed(() => {
    const list = this.featuredRecipes();
    return list.length > 0 ? list[this.currentIndex() % list.length] : undefined;
  });
  protected readonly slotNextRecipe = computed(() => {
    const list = this.featuredRecipes();
    return list.length > 0 ? list[this.nextIndex() % list.length] : undefined;
  });

  private featuredRotationTimer?: ReturnType<typeof setInterval>;
  private featuredSlideTimeout?: ReturnType<typeof setTimeout>;
  private static readonly FEATURED_PAUSE_MS = 5000; // dừng lại ở mỗi món bao lâu trước khi trượt tiếp
  private static readonly FEATURED_SLIDE_MS = 900; // thời lượng trượt — chậm rãi, rõ chuyển động

  protected readonly sortedRecipes = computed(() => {
    if (this.favoriteOnly()) {
      const favIds = this.myFavoriteIds();
      return this.store.recipes().filter((r) => favIds.has(r.id));
    }

    const category = this.activeCategory();
    const list = this.store.recipes().filter((r) => {
      if (category === 'all') return true;
      if (category === 'special') return r.isFavorite;
      return r.category === category;
    });
    switch (this.sortOption()) {
      case 'name-asc':
        return list.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      case 'name-desc':
        return list.sort((a, b) => b.name.localeCompare(a.name, 'vi'));
      case 'price-asc':
        return list.sort((a, b) => a.price - b.price);
      case 'price-desc':
        return list.sort((a, b) => b.price - a.price);
      case 'popular': {
        const counts = this.popularity();
        return list.sort((a, b) => (counts[b.id] ?? 0) - (counts[a.id] ?? 0));
      }
      default:
        return list;
    }
  });

  constructor() {
    this.orderService
      .getPopularity()
      .then((counts) => this.popularity.set(counts))
      .catch(() => this.popularity.set({}));

    this.featuredRotationTimer = setInterval(() => {
      const total = this.featuredRecipes().length;
      if (total > 1) this.goToFeatured((this.currentIndex() + 1) % total);
    }, RecipeList.FEATURED_PAUSE_MS);
  }

  ngOnDestroy(): void {
    clearInterval(this.featuredRotationTimer);
    clearTimeout(this.featuredSlideTimeout);
  }

  // Dùng chung cho cả tự động xoay vòng lẫn bấm chấm chọn thủ công.
  protected goToFeatured(target: number): void {
    const total = this.featuredRecipes().length;
    if (total <= 1 || target === this.currentIndex()) return;

    this.nextIndex.set(target);
    // Đảm bảo transition đang bật (phòng trường hợp gọi liên tiếp trong lúc vừa "nhảy" xong) rồi
    // mới bật .shifting để track thật sự trượt có animation, không bị nhảy cứng.
    this.trackInstant.set(false);
    requestAnimationFrame(() => this.shifting.set(true));

    clearTimeout(this.featuredSlideTimeout);
    this.featuredSlideTimeout = setTimeout(() => {
      this.trackInstant.set(true);
      this.currentIndex.set(target);
      this.shifting.set(false);
      // Tắt instant trở lại ở khung hình sau — để lần trượt tiếp theo có animation như bình thường.
      requestAnimationFrame(() => this.trackInstant.set(false));
    }, RecipeList.FEATURED_SLIDE_MS);
  }

  private loadMyFavoriteIds(): Set<number> {
    try {
      const raw = localStorage.getItem(this.myFavoritesKey);
      return raw ? new Set(JSON.parse(raw) as number[]) : new Set<number>();
    } catch {
      return new Set<number>();
    }
  }

  protected selectPill(category: CategoryFilter): void {
    this.activeCategory.set(category);
    if (this.favoriteOnly()) {
      this.router.navigate(['/recipes']);
    }
  }

  // "Yêu thích" nằm trong menu Bộ lọc — dùng chung query param ?favorite=true với mục sidebar
  // trước đây, giữ đúng hành vi lọc món cá nhân theo localStorage.
  protected selectFavoriteFilter(): void {
    if (!this.favoriteOnly()) {
      this.router.navigate(['/recipes'], { queryParams: { favorite: 'true' } });
    }
  }

  protected selectSort(option: SortOption): void {
    this.sortOption.set(option);
    if (this.favoriteOnly()) {
      this.router.navigate(['/recipes']);
    }
  }

  // Chặn thẻ <a> điều hướng khi bấm icon tim, và không lan sự kiện click ra ngoài.
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
}

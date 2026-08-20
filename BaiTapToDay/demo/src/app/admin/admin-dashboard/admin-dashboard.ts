import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

import { Order, OrderStats, OrderStatus } from '../../models';
import { OrderService } from '../../order-service';
import { RecipeService } from '../../recipe-service';
import { NotificationService } from '../../notification-service';
import { AuthService } from '../../auth-service';
import { resolveImageUrl } from '../../api-config';
import { AdminNav } from '../admin-nav/admin-nav';

const STATUS_LABELS: Record<OrderStatus, string> = {
  dang_lam: 'Đang làm',
  hoan_thanh: 'Hoàn thành',
  bi_huy: 'Bị huỷ',
};

// Màu theo trạng thái — dùng chung cho thẻ thống kê, viền trái, badge bảng và biểu đồ tròn để
// người dùng nối được các mảng dữ liệu khác nhau chỉ bằng màu sắc.
const STATUS_COLORS: Record<OrderStatus, string> = {
  dang_lam: '#f0b429',
  hoan_thanh: '#2e9e5b',
  bi_huy: '#d0453b',
};

const STATUS_ORDER: OrderStatus[] = ['dang_lam', 'hoan_thanh', 'bi_huy'];

// Bảng thống kê đơn hàng cho admin: thẻ số liệu, biểu đồ cột doanh thu 14 ngày, biểu đồ tròn phân
// bố trạng thái, bảng đơn gần đây và top món bán chạy — toàn bộ vẽ bằng SVG/CSS thuần + dữ liệu
// thật từ /orders/stats và /orders (không thêm field/API mới ở backend). Tự làm mới khi có sự
// kiện đơn hàng mới qua SSE.
@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule, MatIconModule, RouterLink, AdminNav],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardPage implements OnInit, OnDestroy {
  private readonly orderService = inject(OrderService);
  private readonly recipeService = inject(RecipeService);
  private readonly notifications = inject(NotificationService);
  protected readonly auth = inject(AuthService);
  protected readonly resolveImageUrl = resolveImageUrl;

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusOrder = STATUS_ORDER;

  protected readonly stats = signal<OrderStats | null>(null);
  protected readonly recentOrders = signal<Order[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');

  protected readonly topRecipes = computed(() => {
    const catalog = this.recipeService.recipes();
    return (this.stats()?.topRecipes ?? []).map((recipe) => {
      const match = catalog.find((r) => r.name === recipe.name);
      return { ...recipe, imgUrl: match?.imgUrl ?? '' };
    });
  });
  protected readonly maxQuantity = computed(() =>
    Math.max(1, ...this.topRecipes().map((recipe) => recipe.quantity)),
  );

  protected readonly revenueByDay = computed(() => this.stats()?.revenueByDay ?? []);
  protected readonly maxRevenue = computed(() =>
    Math.max(1, ...this.revenueByDay().map((day) => day.revenue)),
  );

  // % thay đổi doanh thu 7 ngày gần nhất so với 7 ngày liền trước — tính thẳng từ revenueByDay đã
  // có sẵn (14 ngày), không cần thêm API. null khi 7 ngày trước không có doanh thu (chia cho 0).
  protected readonly revenueTrendPercent = computed<number | null>(() => {
    const days = this.revenueByDay();
    if (days.length < 14) return null;
    const previous = days.slice(0, 7).reduce((sum, d) => sum + d.revenue, 0);
    const current = days.slice(7).reduce((sum, d) => sum + d.revenue, 0);
    if (previous === 0) return null;
    return Math.round(((current - previous) / previous) * 1000) / 10;
  });

  // Biểu đồ tròn phân bố trạng thái đơn hàng — CSS conic-gradient thuần, không dùng thư viện
  // biểu đồ nào. Mỗi phần tử là 1 lát cắt kèm % và mốc bắt đầu/kết thúc để build gradient.
  protected readonly statusSlices = computed(() => {
    const data = this.stats();
    if (!data || data.total === 0) return [];
    let cursor = 0;
    return this.statusOrder.map((status) => {
      const count = data.byStatus[status] ?? 0;
      const percent = (count / data.total) * 100;
      const slice = { status, count, percent, start: cursor, end: cursor + percent };
      cursor += percent;
      return slice;
    });
  });

  protected readonly donutGradient = computed(() => {
    const slices = this.statusSlices();
    if (slices.length === 0) return '#eef0f4';
    const stops = slices.map(
      (s) => `${STATUS_COLORS[s.status]} ${s.start}% ${s.end}%`,
    );
    return `conic-gradient(${stops.join(', ')})`;
  });

  private eventsSub?: Subscription;

  ngOnInit(): void {
    this.loadDashboard();
    this.eventsSub = this.notifications.events$.subscribe(() => this.loadDashboard());
  }

  ngOnDestroy(): void {
    this.eventsSub?.unsubscribe();
  }

  protected async loadDashboard(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const [stats, orders] = await Promise.all([
        this.orderService.getStats(),
        this.orderService.getAllOrders(),
      ]);
      this.stats.set(stats);
      this.recentOrders.set(orders.slice(0, 5));
    } catch {
      this.errorMessage.set('Không tải được số liệu thống kê, vui lòng thử lại.');
    } finally {
      this.loading.set(false);
    }
  }

  protected statusColor(status: OrderStatus): string {
    return STATUS_COLORS[status];
  }

  // Chiều dài thanh cột theo tỉ lệ % so với món bán chạy nhất — tối thiểu 6% để nhãn/giá trị vẫn
  // hiển thị được ngay cả khi số lượng rất nhỏ so với món đứng đầu.
  protected barWidthPercent(quantity: number): number {
    return Math.max(6, (quantity / this.maxQuantity()) * 100);
  }

  // Chiều cao cột doanh thu theo % so với ngày cao nhất — 0đ vẫn giữ cột ở mức tối thiểu để thấy
  // trục ngày, còn ngày có doanh thu thì tối thiểu 4% để không bị "biến mất" khi chênh lệch lớn.
  protected revenueBarHeightPercent(revenue: number): number {
    return revenue === 0 ? 2 : Math.max(4, (revenue / this.maxRevenue()) * 100);
  }

  protected formatCurrency(value: number): string {
    return value.toLocaleString('vi-VN') + 'đ';
  }

  protected formatDayLabel(isoDate: string): string {
    const [, month, day] = isoDate.split('-');
    return `${day}/${month}`;
  }

  protected formatOrderCode(id: string): string {
    return `#${id.slice(-6).toUpperCase()}`;
  }

  protected formatDate(value: string): string {
    return new Date(value).toLocaleDateString('vi-VN');
  }

  protected formatTime(value: string): string {
    return new Date(value).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
  }

  protected itemCount(order: Order): number {
    return order.items.reduce((sum, item) => sum + item.quantity, 0);
  }
}

import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';

import { OrderStats } from '../../models';
import { OrderService } from '../../order-service';
import { NotificationService } from '../../notification-service';
import { AdminNav } from '../admin-nav/admin-nav';

// Bảng thống kê đơn hàng cho admin: tổng số đơn, số lượng theo trạng thái (thẻ trạng thái dùng
// màu + icon + nhãn chữ, không chỉ dựa vào màu), và biểu đồ cột ngang top-5 món bán chạy nhất —
// vẽ hoàn toàn bằng SVG/CSS thuần (không dùng thư viện biểu đồ nào, đúng ràng buộc của đề bài).
// Tự làm mới khi có sự kiện đơn hàng mới qua SSE.
@Component({
  selector: 'app-admin-dashboard',
  imports: [CommonModule, MatIconModule, AdminNav],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardPage implements OnInit, OnDestroy {
  private readonly orderService = inject(OrderService);
  private readonly notifications = inject(NotificationService);

  protected readonly stats = signal<OrderStats | null>(null);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');

  protected readonly topRecipes = computed(() => this.stats()?.topRecipes ?? []);
  protected readonly maxQuantity = computed(() =>
    Math.max(1, ...this.topRecipes().map((recipe) => recipe.quantity)),
  );

  protected readonly revenueByDay = computed(() => this.stats()?.revenueByDay ?? []);
  protected readonly maxRevenue = computed(() =>
    Math.max(1, ...this.revenueByDay().map((day) => day.revenue)),
  );

  private eventsSub?: Subscription;

  ngOnInit(): void {
    this.loadStats();
    this.eventsSub = this.notifications.events$.subscribe(() => this.loadStats());
  }

  ngOnDestroy(): void {
    this.eventsSub?.unsubscribe();
  }

  protected async loadStats(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      this.stats.set(await this.orderService.getStats());
    } catch {
      this.errorMessage.set('Không tải được số liệu thống kê, vui lòng thử lại.');
    } finally {
      this.loading.set(false);
    }
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
}

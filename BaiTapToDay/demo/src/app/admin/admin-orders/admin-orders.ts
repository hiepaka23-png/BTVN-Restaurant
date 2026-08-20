import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';

import { Order, OrderStatus, PaymentStatus } from '../../models';
import { OrderService } from '../../order-service';
import { NotificationService } from '../../notification-service';
import { AdminNav } from '../admin-nav/admin-nav';

const STATUS_LABELS: Record<OrderStatus, string> = {
  dang_lam: 'Đang làm',
  hoan_thanh: 'Hoàn thành',
  bi_huy: 'Bị huỷ',
};

const STATUS_OPTIONS: OrderStatus[] = ['dang_lam', 'hoan_thanh', 'bi_huy'];

const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  chua_thanh_toan: 'Chưa thanh toán',
  da_thanh_toan: 'Đã thanh toán',
};

const PAYMENT_STATUS_OPTIONS: PaymentStatus[] = ['chua_thanh_toan', 'da_thanh_toan'];

// Trang quản trị đơn hàng: xem toàn bộ đơn (GET /orders, admin-only) và đổi trạng thái từng đơn.
// Khi chọn 'bi_huy' phải nhập lý do huỷ trước khi gửi — backend trả 400 nếu thiếu cancelReason.
// Danh sách tự làm mới khi có sự kiện SSE mới (đơn khách vừa tạo/đổi trạng thái).
@Component({
  selector: 'app-admin-orders',
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    AdminNav,
  ],
  templateUrl: './admin-orders.html',
  styleUrl: './admin-orders.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminOrdersPage implements OnInit, OnDestroy {
  private readonly orderService = inject(OrderService);
  private readonly notifications = inject(NotificationService);

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusOptions = STATUS_OPTIONS;
  protected readonly paymentStatusLabels = PAYMENT_STATUS_LABELS;
  protected readonly paymentStatusOptions = PAYMENT_STATUS_OPTIONS;

  protected readonly orders = signal<Order[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');

  // Đơn đang chờ nhập lý do huỷ (đã chọn 'bi_huy' trên dropdown nhưng chưa xác nhận gửi).
  protected readonly pendingCancelId = signal<string | null>(null);
  protected readonly cancelReasonDraft = signal('');
  protected readonly updatingId = signal<string | null>(null);
  protected readonly updatingPaymentId = signal<string | null>(null);

  private eventsSub?: Subscription;

  ngOnInit(): void {
    this.loadOrders();
    this.eventsSub = this.notifications.events$.subscribe(() => this.loadOrders());
  }

  ngOnDestroy(): void {
    this.eventsSub?.unsubscribe();
  }

  protected async loadOrders(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const orders = await this.orderService.getAllOrders();
      this.orders.set(orders.sort((a, b) => b.createdAt.localeCompare(a.createdAt)));
    } catch {
      this.errorMessage.set('Không tải được danh sách đơn hàng, vui lòng thử lại.');
    } finally {
      this.loading.set(false);
    }
  }

  protected formatPrice(value: number): string {
    return value.toLocaleString('vi-VN') + 'đ';
  }

  protected formatDate(value: string): string {
    return new Date(value).toLocaleString('vi-VN');
  }

  protected onStatusSelected(order: Order, newStatus: OrderStatus): void {
    if (newStatus === order.status) {
      return;
    }
    if (newStatus === 'bi_huy') {
      this.pendingCancelId.set(order._id);
      this.cancelReasonDraft.set('');
      return;
    }
    this.applyStatus(order, newStatus);
  }

  protected cancelPendingCancel(): void {
    this.pendingCancelId.set(null);
    this.cancelReasonDraft.set('');
  }

  protected async confirmCancelStatus(order: Order): Promise<void> {
    const reason = this.cancelReasonDraft().trim();
    if (!reason) {
      this.errorMessage.set('Vui lòng nhập lý do huỷ đơn.');
      return;
    }
    await this.applyStatus(order, 'bi_huy', reason);
    this.pendingCancelId.set(null);
    this.cancelReasonDraft.set('');
  }

  // Chủ yếu dùng cho đơn chuyển khoản: admin xác nhận thủ công đã nhận tiền (không có cổng thanh
  // toán thật để tự động xác nhận). Đơn COD tự chuyển "đã thanh toán" khi hoàn tất nên hiếm khi
  // cần đổi tay, nhưng vẫn cho phép nếu admin muốn chỉnh lại.
  protected async onPaymentStatusSelected(order: Order, newStatus: PaymentStatus): Promise<void> {
    if (newStatus === order.paymentStatus) {
      return;
    }
    this.errorMessage.set('');
    this.updatingPaymentId.set(order._id);
    try {
      const updated = await this.orderService.setPaymentStatus(order._id, newStatus);
      this.orders.update((orders) => orders.map((o) => (o._id === order._id ? updated : o)));
    } catch (error: any) {
      this.errorMessage.set(error?.error?.message || 'Cập nhật trạng thái thanh toán thất bại.');
    } finally {
      this.updatingPaymentId.set(null);
    }
  }

  private async applyStatus(order: Order, status: OrderStatus, cancelReason?: string): Promise<void> {
    this.errorMessage.set('');
    this.updatingId.set(order._id);
    try {
      const updated = await this.orderService.updateOrderStatus(order._id, status, cancelReason);
      this.orders.update((orders) => orders.map((o) => (o._id === order._id ? updated : o)));
    } catch (error: any) {
      this.errorMessage.set(error?.error?.message || 'Cập nhật trạng thái đơn hàng thất bại.');
    } finally {
      this.updatingId.set(null);
    }
  }
}

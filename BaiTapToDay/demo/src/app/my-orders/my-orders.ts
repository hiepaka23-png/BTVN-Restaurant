import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { firstValueFrom, Subscription } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';

import { Order } from '../models';
import { OrderService } from '../order-service';
import { CancelOrderDialog } from '../cancel-order-dialog/cancel-order-dialog';
import { NAME_PATTERN, VN_PHONE_PATTERN, ADDRESS_PATTERN } from '../validators';
import { NotificationService } from '../notification-service';
import { BackLink } from '../back-link/back-link';
import { AutofillSyncDirective } from '../autofill-sync-directive';

const STATUS_LABELS: Record<Order['status'], string> = {
  dang_lam: 'Đang làm',
  hoan_thanh: 'Hoàn thành',
  bi_huy: 'Bị huỷ',
};

// Trang "Đơn hàng của tôi": danh sách đơn của người dùng hiện tại (GET /orders/me), cho phép
// sửa thông tin giao hàng hoặc huỷ đơn CHỈ khi đơn còn ở trạng thái 'dang_lam' — backend cũng tự
// chặn (400) nếu gọi sai trạng thái, nhưng UI ẩn/khóa hành động trước để tránh gọi API vô ích.
@Component({
  selector: 'app-my-orders',
  imports: [
    CommonModule,
    RouterLink,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    BackLink,
    AutofillSyncDirective,
  ],
  templateUrl: './my-orders.html',
  styleUrl: './my-orders.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyOrdersPage implements OnInit, OnDestroy {
  private readonly orderService = inject(OrderService);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly notifications = inject(NotificationService);

  protected readonly statusLabels = STATUS_LABELS;

  protected readonly orders = signal<Order[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');

  protected readonly editingId = signal<string | null>(null);
  protected readonly editForm: FormGroup = this.fb.group({
    recipientName: ['', [Validators.required, Validators.minLength(2), Validators.pattern(NAME_PATTERN)]],
    phone: ['', [Validators.required, Validators.pattern(VN_PHONE_PATTERN)]],
    address: ['', [Validators.required, Validators.minLength(5), Validators.pattern(ADDRESS_PATTERN)]],
    note: [''],
  });
  protected readonly editSubmitting = signal(false);
  protected readonly editError = signal('');

  private eventsSub?: Subscription;

  ngOnInit(): void {
    this.loadOrders();
    // Cập nhật danh sách theo thời gian thực khi admin đổi trạng thái đơn của mình (SSE).
    this.eventsSub = this.notifications.events$.subscribe((event) => {
      if (event.type === 'order_status_changed' || event.type === 'order_created') {
        this.loadOrders();
      }
    });
  }

  ngOnDestroy(): void {
    this.eventsSub?.unsubscribe();
  }

  protected async loadOrders(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      const orders = await this.orderService.getMyOrders();
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

  protected startEdit(order: Order): void {
    this.editError.set('');
    this.editingId.set(order._id);
    this.editForm.setValue({
      recipientName: order.recipientName,
      phone: order.phone,
      address: order.address,
      note: order.note ?? '',
    });
  }

  protected cancelEdit(): void {
    this.editingId.set(null);
    this.editError.set('');
  }

  protected async saveEdit(orderId: string): Promise<void> {
    this.editError.set('');
    if (this.editForm.invalid) {
      this.editForm.markAllAsTouched();
      return;
    }

    this.editSubmitting.set(true);
    try {
      const updated = await this.orderService.updateOrder(orderId, this.editForm.value);
      this.orders.update((orders) => orders.map((order) => (order._id === orderId ? updated : order)));
      this.editingId.set(null);
    } catch (error: any) {
      this.editError.set(error?.error?.message || 'Cập nhật đơn hàng thất bại, vui lòng thử lại.');
    } finally {
      this.editSubmitting.set(false);
    }
  }

  protected async cancelOrder(order: Order): Promise<void> {
    const dialogRef = this.dialog.open(CancelOrderDialog, {
      panelClass: 'brand-dialog-panel',
    });
    const reason: string | null = await firstValueFrom(dialogRef.afterClosed());
    if (!reason) {
      return;
    }

    try {
      const updated = await this.orderService.cancelOrder(order._id, reason);
      this.orders.update((orders) => orders.map((o) => (o._id === order._id ? updated : o)));
    } catch (error: any) {
      this.errorMessage.set(error?.error?.message || 'Huỷ đơn hàng thất bại, vui lòng thử lại.');
    }
  }
}

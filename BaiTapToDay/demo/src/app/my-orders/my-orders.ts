import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
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
import { RecipeService } from '../recipe-service';
import { CartService } from '../cart-service';
import { AuthService } from '../auth-service';
import { CancelOrderDialog } from '../cancel-order-dialog/cancel-order-dialog';
import { NAME_PATTERN, VN_PHONE_PATTERN, ADDRESS_PATTERN } from '../validators';
import { NotificationService } from '../notification-service';
import { ToastService } from '../toast-service';
import { AutofillSyncDirective } from '../autofill-sync-directive';
import { resolveImageUrl } from '../api-config';
import { buildBankQrUrl } from '../bank-config';
import { BackLink } from '../back-link/back-link';

const STATUS_LABELS: Record<Order['status'], string> = {
  dang_lam: 'Đang xử lý',
  hoan_thanh: 'Đã hoàn thành',
  bi_huy: 'Đã huỷ',
};

const STATUS_ICONS: Record<Order['status'], string> = {
  dang_lam: 'hourglass_top',
  hoan_thanh: 'check_circle',
  bi_huy: 'cancel',
};

const PAYMENT_METHOD_LABELS: Record<Order['paymentMethod'], string> = {
  cod: 'Thanh toán khi nhận hàng (COD)',
  bank_transfer: 'Chuyển khoản ngân hàng',
};

const PAYMENT_STATUS_LABELS: Record<Order['paymentStatus'], string> = {
  chua_thanh_toan: 'Chưa thanh toán',
  da_thanh_toan: 'Đã thanh toán',
};

interface TimelineStep {
  label: string;
  done: boolean;
  current: boolean;
  time: string | null;
}

// Đơn hàng của hệ thống này là đơn GIAO/NHẬN món (có địa chỉ, người nhận), không phải phiếu đặt
// bàn — nên không có "ngày/giờ đặt bàn" hay "số khách". Trạng thái cũng chỉ có 3 mức thật
// (dang_lam/hoan_thanh/bi_huy), không có các bước con "đã xác nhận"/"đang chuẩn bị" kèm mốc giờ
// riêng — timeline bên dưới phản ánh đúng 3 mức đó, dùng createdAt/updatedAt thật thay vì bịa mốc
// giờ cho từng bước.
function buildTimeline(order: Order): TimelineStep[] {
  const createdAt = order.createdAt;
  const updatedAt = order.updatedAt;
  if (order.status === 'bi_huy') {
    return [
      { label: 'Đặt hàng thành công', done: true, current: false, time: createdAt },
      { label: 'Đã huỷ', done: true, current: true, time: updatedAt },
    ];
  }
  const isDone = order.status === 'hoan_thanh';
  return [
    { label: 'Đặt hàng thành công', done: true, current: false, time: createdAt },
    { label: 'Đang chuẩn bị', done: isDone, current: !isDone, time: isDone ? updatedAt : null },
    { label: 'Hoàn tất', done: isDone, current: isDone, time: isDone ? updatedAt : null },
  ];
}

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
    AutofillSyncDirective,
    BackLink,
  ],
  templateUrl: './my-orders.html',
  styleUrl: './my-orders.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyOrdersPage implements OnInit, OnDestroy {
  private readonly orderService = inject(OrderService);
  private readonly recipeService = inject(RecipeService);
  private readonly cart = inject(CartService);
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  private readonly fb = inject(FormBuilder);
  private readonly notifications = inject(NotificationService);
  private readonly toast = inject(ToastService);

  protected readonly statusLabels = STATUS_LABELS;
  protected readonly statusIcons = STATUS_ICONS;
  protected readonly paymentMethodLabels = PAYMENT_METHOD_LABELS;
  protected readonly paymentStatusLabels = PAYMENT_STATUS_LABELS;
  protected readonly resolveImageUrl = resolveImageUrl;
  protected readonly buildTimeline = buildTimeline;

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

  protected readonly reorderingId = signal<string | null>(null);

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

  // Ảnh món trong đơn lấy theo recipeId đối chiếu với danh mục món hiện có — đơn hàng không tự lưu
  // ảnh riêng. Món đã bị admin xoá khỏi thực đơn thì không tìm được ảnh, trả về null (UI tự có
  // icon thay thế), không bịa ảnh giả.
  protected itemImage(recipeId: number): string | null {
    const recipe = this.recipeService.recipes().find((r) => r.id === recipeId);
    return recipe ? this.resolveImageUrl(recipe.imgUrl) : null;
  }

  // Mã QR chuyển khoản đúng số tiền của đơn — nội dung chuyển khoản gắn theo mã đơn để nhà hàng
  // dễ đối chiếu khi xác nhận thanh toán thủ công.
  protected paymentQrUrl(order: Order): string {
    return buildBankQrUrl(order.total, `DH${order._id.slice(-6)}`);
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

  // "Đặt lại đơn này" — thêm lại đúng các món trong đơn cũ vào giỏ hàng theo giá/tên MỚI NHẤT của
  // món (không dùng giá cũ đã đặt, tránh đặt nhầm giá lỗi thời). Món nào đã bị gỡ khỏi thực đơn thì
  // bỏ qua và báo cho người dùng biết, không chặn toàn bộ thao tác.
  protected async reorder(order: Order): Promise<void> {
    this.reorderingId.set(order._id);
    try {
      const catalog = this.recipeService.recipes();
      let addedCount = 0;
      let missingCount = 0;
      for (const item of order.items) {
        const recipe = catalog.find((r) => r.id === item.recipeId);
        if (recipe) {
          this.cart.addItem(recipe, item.quantity);
          addedCount++;
        } else {
          missingCount++;
        }
      }

      if (addedCount === 0) {
        this.toast.show('Các món trong đơn này không còn trong thực đơn.');
        return;
      }
      const message =
        missingCount > 0
          ? `Đã thêm ${addedCount} món vào giỏ (${missingCount} món không còn bán).`
          : `Đã thêm ${addedCount} món vào giỏ hàng.`;
      this.toast.show(message);
      this.router.navigate(['/cart']);
    } finally {
      this.reorderingId.set(null);
    }
  }
}

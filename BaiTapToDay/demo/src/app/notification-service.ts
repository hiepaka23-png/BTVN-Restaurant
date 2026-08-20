import { effect, inject, Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { AuthService } from './auth-service';
import { Order } from './models';
import { API_ORIGIN } from './api-config';
import { ToastService } from './toast-service';

export const SSE_URL = `${API_ORIGIN}/notifications/sse`;

export type NotificationEventType = 'order_created' | 'order_status_changed';

export interface NotificationEvent {
  type: NotificationEventType;
  order: Order;
  timestamp: string;
}

const STATUS_LABELS: Record<Order['status'], string> = {
  dang_lam: 'Đang làm',
  hoan_thanh: 'Hoàn thành',
  bi_huy: 'Bị huỷ',
};

// Kết nối SSE tới GET /notifications/sse để nhận sự kiện đơn hàng theo thời gian thực. Admin nhận
// mọi sự kiện; user thường chỉ nhận sự kiện của chính đơn hàng của họ (backend tự lọc theo
// username trong token). Service tự mở/đóng kết nối theo trạng thái đăng nhập (effect trên
// AuthService.currentUser) và phát lại sự kiện qua events$ để các trang (my-orders, admin/orders,
// admin/dashboard) tự làm mới dữ liệu; đồng thời tự hiện toast cho MỌI sự kiện nhận được — vì mỗi
// kết nối chỉ nhận đúng sự kiện liên quan tới người xem hiện tại.
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly events$ = new Subject<NotificationEvent>();

  private eventSource: EventSource | null = null;

  constructor() {
    effect(() => {
      const user = this.authService.currentUser();
      if (user) {
        this.connect();
      } else {
        this.disconnect();
      }
    });
  }

  private connect(): void {
    const token = this.authService.getAccessToken();
    if (!token || this.eventSource) {
      return;
    }

    this.eventSource = new EventSource(`${SSE_URL}?token=${encodeURIComponent(token)}`);
    this.eventSource.onmessage = (message: MessageEvent<string>) => {
      try {
        const event = JSON.parse(message.data) as NotificationEvent;
        this.events$.next(event);
        this.showToast(event);
      } catch {
        // Bỏ qua payload không hợp lệ
      }
    };
    this.eventSource.onerror = () => {
      // EventSource tự động thử kết nối lại — không cần xử lý thủ công ở đây.
    };
  }

  private disconnect(): void {
    this.eventSource?.close();
    this.eventSource = null;
  }

  private showToast(event: NotificationEvent): void {
    const statusLabel = STATUS_LABELS[event.order.status];
    const message =
      event.type === 'order_created'
        ? `Đơn hàng #${event.order._id.slice(-6)} vừa được tạo.`
        : `Đơn hàng #${event.order._id.slice(-6)} đã chuyển sang trạng thái "${statusLabel}".`;

    this.toast.show(message, 'Thông báo', 5000);
  }
}

import { effect, inject, Injectable } from '@angular/core';
import { Subject } from 'rxjs';
import { AuthService } from './auth-service';
import { Order } from './models';
import { API_ORIGIN } from './api-config';
import { ToastService } from './toast-service';

export const SSE_URL = `${API_ORIGIN}/notifications/sse`;

export type NotificationEventType =
  | 'order_created'
  | 'order_status_changed'
  | 'user_banned'
  | 'reservation_created'
  | 'contact_message_created'
  | 'job_application_created';

export interface OrderNotificationEvent {
  type: 'order_created' | 'order_status_changed';
  order: Order;
  timestamp: string;
}

// Backend chỉ gửi sự kiện này cho đúng người bị ban (đã lọc theo userId ở NotificationsController),
// nên nhận được là biết chắc "mình" vừa bị ban — không cần kiểm tra thêm gì ở đây.
export interface UserBannedNotificationEvent {
  type: 'user_banned';
  timestamp: string;
}

// Ba sự kiện dưới đây backend chỉ gửi cho admin (xem NotificationsController) — dùng để báo có
// người vừa đặt bàn / gửi liên hệ / nộp hồ sơ ứng tuyển, kèm đủ thông tin để hiện toast có ý nghĩa
// mà không cần gọi thêm API nào.
export interface ReservationNotificationEvent {
  type: 'reservation_created';
  reservation: { id: string; customerName: string; date: string; time: string };
  timestamp: string;
}

export interface ContactMessageNotificationEvent {
  type: 'contact_message_created';
  contactMessage: { id: string; fullName: string; subject: string };
  timestamp: string;
}

export interface JobApplicationNotificationEvent {
  type: 'job_application_created';
  jobApplication: { id: string; fullName: string; position: string };
  timestamp: string;
}

export type NotificationEvent =
  | OrderNotificationEvent
  | UserBannedNotificationEvent
  | ReservationNotificationEvent
  | ContactMessageNotificationEvent
  | JobApplicationNotificationEvent;

// Câu tự nhiên theo từng trạng thái (thay vì "đã chuyển sang trạng thái X" nghe cứng/máy móc) —
// ghép sau "Đơn hàng #xxx (của bạn)" nên viết liền mạch, không lặp lại chữ "đơn hàng"/"trạng thái".
const STATUS_PHRASES: Record<Order['status'], string> = {
  dang_lam: 'đang được chuẩn bị',
  hoan_thanh: 'đã hoàn thành',
  bi_huy: 'đã bị huỷ',
};

// Kết nối SSE tới GET /notifications/sse để nhận sự kiện theo thời gian thực. Admin nhận mọi sự
// kiện (đơn hàng, đặt bàn, liên hệ, ứng tuyển); user thường chỉ nhận sự kiện của chính đơn hàng của
// họ (backend tự lọc theo username/role trong token). Service tự mở/đóng kết nối theo trạng thái
// đăng nhập (effect trên AuthService.currentUser) và phát lại sự kiện đơn hàng qua events$ để các
// trang (my-orders, admin/orders, admin/dashboard) tự làm mới dữ liệu; đồng thời tự hiện toast cho
// mọi sự kiện — bấm vào toast (trừ nút đóng) điều hướng thẳng tới trang quản trị tương ứng.
@Injectable({ providedIn: 'root' })
export class NotificationService {
  private readonly authService = inject(AuthService);
  private readonly toast = inject(ToastService);

  readonly events$ = new Subject<OrderNotificationEvent>();

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
        this.handleEvent(event);
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

  private handleEvent(event: NotificationEvent): void {
    switch (event.type) {
      case 'user_banned':
        // Đá ngay về trang đăng nhập, không đợi access token hết hạn — không cần phát qua events$
        // (không có trang nào khác cần biết) hay hiện toast (trang sẽ điều hướng đi ngay).
        this.disconnect();
        this.authService.forceLogout('banned');
        return;
      case 'order_created':
      case 'order_status_changed':
        this.events$.next(event);
        this.showOrderToast(event);
        return;
      case 'reservation_created':
        this.toast.show(
          `${event.reservation.customerName} vừa đặt bàn lúc ${event.reservation.time} ngày ${this.formatBookingDate(event.reservation.date)}.`,
          'Có yêu cầu đặt bàn mới',
          6000,
          '/admin/reservations',
        );
        return;
      case 'contact_message_created':
        this.toast.show(
          `${event.contactMessage.fullName} vừa gửi liên hệ: "${event.contactMessage.subject}".`,
          'Có tin nhắn liên hệ mới',
          6000,
          '/admin/contact-messages',
        );
        return;
      case 'job_application_created':
        this.toast.show(
          `${event.jobApplication.fullName} vừa nộp hồ sơ ứng tuyển vị trí "${event.jobApplication.position}".`,
          'Có hồ sơ ứng tuyển mới',
          6000,
          '/admin/careers',
        );
        return;
    }
  }

  private showOrderToast(event: OrderNotificationEvent): void {
    const code = `#${event.order._id.slice(-6)}`;
    // Chỉ thêm "của bạn" khi đúng là đơn của người đang xem — admin xem đơn của người khác thì
    // không thêm, tránh nghe như đang nhận nhầm đơn hàng của chính mình.
    const isOwn = event.order.username === this.authService.currentUser()?.username;
    const subject = isOwn ? `Đơn hàng ${code} của bạn` : `Đơn hàng ${code}`;
    const message =
      event.type === 'order_created'
        ? `${subject} vừa được tạo thành công.`
        : `${subject} ${STATUS_PHRASES[event.order.status]}.`;

    // Admin bấm vào toast -> xem bảng đơn hàng quản trị; khách hàng bấm vào -> xem đơn của chính họ.
    const route = this.authService.isAdmin() ? '/admin/orders' : '/orders';
    this.toast.show(message, 'Thông báo', 5000, route);
  }

  private formatBookingDate(value: string): string {
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }
}

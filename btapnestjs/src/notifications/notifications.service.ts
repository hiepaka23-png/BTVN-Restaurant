import { Injectable } from '@nestjs/common';
import { Subject } from 'rxjs';

export interface OrderEventPayload {
  username: string;
  status: string;
}

export interface OrderNotificationEvent {
  type: 'order_created' | 'order_status_changed';
  order: OrderEventPayload;
  timestamp: string;
}

// Gửi riêng cho đúng userId bị ban (không đi qua username/role như sự kiện đơn hàng) — xem filter
// tương ứng ở NotificationsController.
export interface UserBannedNotificationEvent {
  type: 'user_banned';
  userId: string;
  timestamp: string;
}

export interface ReservationEventPayload {
  id: string;
  customerName: string;
  date: string;
  time: string;
}

export interface ReservationNotificationEvent {
  type: 'reservation_created';
  reservation: ReservationEventPayload;
  timestamp: string;
}

export interface ContactMessageEventPayload {
  id: string;
  fullName: string;
  subject: string;
}

export interface ContactMessageNotificationEvent {
  type: 'contact_message_created';
  contactMessage: ContactMessageEventPayload;
  timestamp: string;
}

export interface JobApplicationEventPayload {
  id: string;
  fullName: string;
  position: string;
}

export interface JobApplicationNotificationEvent {
  type: 'job_application_created';
  jobApplication: JobApplicationEventPayload;
  timestamp: string;
}

export type AppNotificationEvent =
  | OrderNotificationEvent
  | UserBannedNotificationEvent
  | ReservationNotificationEvent
  | ContactMessageNotificationEvent
  | JobApplicationNotificationEvent;

// BE-18: bus thông báo realtime dùng RxJS Subject, phát qua SSE ở NotificationsController.
@Injectable()
export class NotificationsService {
  private readonly events$ = new Subject<AppNotificationEvent>();

  readonly stream$ = this.events$.asObservable();

  emitOrderCreated(order: OrderEventPayload): void {
    this.events$.next({
      type: 'order_created',
      order,
      timestamp: new Date().toISOString(),
    });
  }

  emitOrderStatusChanged(order: OrderEventPayload): void {
    this.events$.next({
      type: 'order_status_changed',
      order,
      timestamp: new Date().toISOString(),
    });
  }

  emitUserBanned(userId: string): void {
    this.events$.next({
      type: 'user_banned',
      userId,
      timestamp: new Date().toISOString(),
    });
  }

  // Ba sự kiện dưới đây CHỈ dành cho admin (lọc theo role ở NotificationsController) — người dùng
  // gửi liên hệ/hồ sơ/đặt bàn không cần nhận lại thông báo của chính họ (đã có successMessage trên
  // form ngay khi gửi).
  emitReservationCreated(reservation: ReservationEventPayload): void {
    this.events$.next({
      type: 'reservation_created',
      reservation,
      timestamp: new Date().toISOString(),
    });
  }

  emitContactMessageCreated(contactMessage: ContactMessageEventPayload): void {
    this.events$.next({
      type: 'contact_message_created',
      contactMessage,
      timestamp: new Date().toISOString(),
    });
  }

  emitJobApplicationCreated(jobApplication: JobApplicationEventPayload): void {
    this.events$.next({
      type: 'job_application_created',
      jobApplication,
      timestamp: new Date().toISOString(),
    });
  }
}

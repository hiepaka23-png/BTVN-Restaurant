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

export type AppNotificationEvent =
  | OrderNotificationEvent
  | UserBannedNotificationEvent;

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
}

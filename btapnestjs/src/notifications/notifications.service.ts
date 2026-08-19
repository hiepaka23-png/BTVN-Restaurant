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

// BE-18: bus thông báo realtime dùng RxJS Subject, phát qua SSE ở NotificationsController.
@Injectable()
export class NotificationsService {
  private readonly events$ = new Subject<OrderNotificationEvent>();

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
}

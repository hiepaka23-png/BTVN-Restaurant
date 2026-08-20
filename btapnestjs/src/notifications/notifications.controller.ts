import {
  Controller,
  MessageEvent,
  Query,
  Sse,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { filter, map, Observable } from 'rxjs';
import { NotificationsService } from './notifications.service';
import { verifyCustomJwt } from '../auth/custom-jwt.util';

// EventSource của trình duyệt không gửi được header Authorization,
// nên token được truyền qua query string và tự xác thực thủ công ở đây
// thay vì dùng JwtAuthGuard như các route REST khác.
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  @Sse('sse')
  sse(@Query('token') token?: string): Observable<MessageEvent> {
    if (!token) {
      throw new UnauthorizedException('Thiếu token');
    }

    const secret = this.configService.getOrThrow<string>('JWT_SECRET');
    const decoded = verifyCustomJwt(token, secret);
    if (!decoded) {
      throw new UnauthorizedException('Token không hợp lệ hoặc đã hết hạn');
    }
    const role = decoded.role as string;
    const username = decoded.username as string;

    return this.notificationsService.stream$.pipe(
      filter((event) => {
        if (event.type === 'user_banned') {
          return event.userId === decoded.sub;
        }
        if (event.type === 'order_created' || event.type === 'order_status_changed') {
          return role === 'admin' || event.order.username === username;
        }
        // reservation_created / contact_message_created / job_application_created: chỉ admin cần
        // biết, người gửi đã thấy successMessage ngay trên form rồi.
        return role === 'admin';
      }),
      map((event) => ({ data: event })),
    );
  }
}

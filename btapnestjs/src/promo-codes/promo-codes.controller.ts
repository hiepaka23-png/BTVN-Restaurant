import { Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { PromoCodesService } from './promo-codes.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { AuthenticatedRequest } from '../auth/types/auth-user.interface';

@UseGuards(JwtAuthGuard)
@Controller('promo-codes')
export class PromoCodesController {
  constructor(private readonly promoCodesService: PromoCodesService) {}

  // Mở hộp quà — 1 lượt/ngày/tài khoản, kiểm tra ở server (xem PromoCodesService.claimDaily).
  @Post('claim')
  claim(@Req() req: AuthenticatedRequest) {
    return this.promoCodesService.claimDaily(req.user.userId);
  }

  // Mã đã nhận trong hôm nay (nếu có) — dùng để khôi phục trạng thái "đã mở quà" khi tải lại trang.
  @Get('today')
  today(@Req() req: AuthenticatedRequest) {
    return this.promoCodesService.getTodayCode(req.user.userId);
  }
}

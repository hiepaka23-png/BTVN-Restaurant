import {
  BadRequestException,
  Controller,
  Get,
  NotFoundException,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
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

  // Xem trước BẤT KỲ mã nào người dùng tự gõ ở giỏ hàng (mã công khai quảng cáo hoặc mã riêng đã
  // nhận từ Hộp Quà May Mắn) — không khoá mã, chỉ để hiện trước số tiền được giảm.
  @Get('preview')
  async preview(@Req() req: AuthenticatedRequest, @Query('code') code?: string) {
    if (!code?.trim()) {
      throw new BadRequestException('Vui lòng nhập mã giảm giá');
    }
    const result = await this.promoCodesService.preview(req.user.userId, code);
    if (!result) {
      throw new NotFoundException('Mã không hợp lệ hoặc đã được sử dụng');
    }
    return result;
  }
}

import {
  Controller,
  Get,
  UseGuards,
  SetMetadata,
  Request,
} from '@nestjs/common';
import { AppService } from './app.service';
import { JwtAuthGuard } from './auth/guards/jwt-auth.guard';
import { RolesGuard } from './auth/guards/roles.guard';
import type { AuthenticatedRequest } from './auth/types/auth-user.interface';

// Decorator hỗ trợ set roles cho từng route
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  // // 1. Route mặc định cũ của bạn (ai truy cập cũng được)
  // @Get()
  // getHello(): string {
  //   return this.appService.getHello();
  // }

  // 2. Route yêu cầu PHẢI ĐĂNG NHẬP (Gửi kèm Token hợp lệ)
  @UseGuards(JwtAuthGuard)
  @Get('profile')
  getProfile(@Request() req: AuthenticatedRequest) {
    return req.user; // Trả về thông tin user giải mã từ Token (sub, username, role)
  }

  // 3. Route yêu cầu ĐĂNG NHẬP + ROLE ADMIN
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('admin')
  @Get('admin-only')
  getAdminData() {
    return {
      message: 'Chúc mừng! Bạn truy cập vào trang riêng của Admin thành công.',
    };
  }
}

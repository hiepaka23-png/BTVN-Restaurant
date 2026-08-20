import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { OrdersService } from './orders.service';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { SetOrderStatusDto } from './dto/set-order-status.dto';
import { SetPaymentStatusDto } from './dto/set-payment-status.dto';
import { CancelOrderDto } from './dto/cancel-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/types/auth-user.interface';

// Mọi thao tác đơn hàng yêu cầu đăng nhập; xem toàn bộ đơn hàng chỉ dành cho admin.
@UseGuards(JwtAuthGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  // AD-00: Admin không được tự đặt món, chỉ role 'user' mới tạo đơn được.
  @UseGuards(RolesGuard)
  @Roles('user')
  @Post()
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateOrderDto) {
    return this.ordersService.create(req.user.userId, req.user.username, dto);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get()
  findAll() {
    return this.ordersService.findAll();
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get('stats')
  stats() {
    return this.ordersService.stats();
  }

  @Get('me')
  findMine(@Req() req: AuthenticatedRequest) {
    return this.ordersService.findByUserId(req.user.userId);
  }

  // Mở cho mọi người dùng đã đăng nhập (không chỉ admin) — dùng để sắp xếp "phổ biến nhất" ở
  // trang danh sách món, không phải thông tin quản trị nhạy cảm.
  @Get('popularity')
  popularity() {
    return this.ordersService.popularityByRecipe();
  }

  @Patch(':id')
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateOrderDto,
  ) {
    return this.ordersService.updateOwn(id, req.user.userId, dto);
  }

  @Patch(':id/cancel')
  cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: CancelOrderDto,
  ) {
    return this.ordersService.cancelOwn(id, req.user.userId, dto.reason);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Patch(':id/status')
  setStatus(@Param('id') id: string, @Body() dto: SetOrderStatusDto) {
    return this.ordersService.setStatus(id, dto.status, dto.cancelReason);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Patch(':id/payment-status')
  setPaymentStatus(@Param('id') id: string, @Body() dto: SetPaymentStatusDto) {
    return this.ordersService.setPaymentStatus(
      id,
      dto.paymentStatus,
      dto.transactionId,
    );
  }
}

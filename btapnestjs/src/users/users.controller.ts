import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { ChangeRoleDto } from './dto/change-role.dto';
import { ConfirmDeleteAccountDto } from './dto/confirm-delete-account.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/types/auth-user.interface';
import { User } from './user.schema';
import { NotificationsService } from '../notifications/notifications.service';

function toPublicUser(user: User) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
    isSuperAdmin: user.isSuperAdmin,
    isBanned: user.isBanned,
  };
}

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Get('me')
  async getMe(@Req() req: AuthenticatedRequest) {
    const user = await this.usersService.findById(req.user.userId);
    if (!user) throw new NotFoundException('Không tìm thấy tài khoản');
    return toPublicUser(user);
  }

  @Patch('me')
  async updateMe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    const updated = await this.usersService.updateProfile(req.user.userId, dto);
    if (!updated) throw new NotFoundException('Không tìm thấy tài khoản');
    return toPublicUser(updated);
  }

  @Patch('me/password')
  async changeMyPassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(
      req.user.userId,
      dto.currentPassword,
      dto.newPassword,
    );
    return { message: 'Đổi mật khẩu thành công' };
  }

  @Post('me/delete/request')
  async requestDeleteAccount(@Req() req: AuthenticatedRequest) {
    return this.usersService.requestAccountDeletion(req.user.userId);
  }

  @Delete('me')
  async deleteMe(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ConfirmDeleteAccountDto,
  ) {
    await this.usersService.deleteById(req.user.userId, dto.token);
    return { message: 'Đã xoá tài khoản' };
  }

  // --- Quản trị (AD-05 / AD-06 / AD-07) ---

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get()
  async findAll(
    @Query('keyword') keyword?: string,
    @Query('role') role?: string,
  ) {
    const users = await this.usersService.findAll(keyword, role);
    return users.map(toPublicUser);
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Patch(':id/role')
  async changeRole(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
    @Body() dto: ChangeRoleDto,
  ) {
    if (id === req.user.userId) {
      throw new ForbiddenException(
        'Không thể tự thay đổi quyền của chính mình',
      );
    }
    const updated = await this.usersService.setRole(id, dto.role);
    if (!updated) throw new NotFoundException('Không tìm thấy tài khoản');
    return toPublicUser(updated);
  }

  // Ban/unban: chỉ super admin (chủ hệ thống) mới thực hiện được — admin thường (kể cả vừa được
  // cấp quyền) bị SuperAdminGuard chặn dù đã qua @Roles('admin').
  @UseGuards(RolesGuard, SuperAdminGuard)
  @Roles('admin')
  @Patch(':id/ban')
  async banUser(@Req() req: AuthenticatedRequest, @Param('id') id: string) {
    if (id === req.user.userId) {
      throw new ForbiddenException('Không thể tự ban chính mình');
    }
    const updated = await this.usersService.setBanned(id, true);
    if (!updated) throw new NotFoundException('Không tìm thấy tài khoản');
    // Đá ngay khỏi phiên đang mở (nếu có) thay vì đợi access token hết hạn (tối đa 10 phút).
    this.notificationsService.emitUserBanned(id);
    return toPublicUser(updated);
  }

  @UseGuards(RolesGuard, SuperAdminGuard)
  @Roles('admin')
  @Patch(':id/unban')
  async unbanUser(@Param('id') id: string) {
    const updated = await this.usersService.setBanned(id, false);
    if (!updated) throw new NotFoundException('Không tìm thấy tài khoản');
    return toPublicUser(updated);
  }
}

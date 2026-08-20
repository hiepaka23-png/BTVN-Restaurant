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
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/types/auth-user.interface';
import { User } from './user.schema';

function toPublicUser(user: User) {
  return {
    id: user._id,
    username: user.username,
    email: user.email,
    name: user.name,
    role: user.role,
    avatarUrl: user.avatarUrl,
  };
}

@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
}

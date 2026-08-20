import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { UsersService } from '../../users/users.service';
import { AuthenticatedRequest } from '../types/auth-user.interface';

// Chỉ tài khoản chủ hệ thống (isSuperAdmin=true) mới qua được — kể cả tài khoản đã có role
// 'admin' (được cấp qua PATCH /users/:id/role) cũng bị chặn. Tra DB trực tiếp thay vì đọc từ JWT
// vì claim trong token không có isSuperAdmin và không cần thiết phải thêm (chỉ dùng cho 2 route
// ban/unban, tần suất thấp, tra DB mỗi lần không đáng kể).
@Injectable()
export class SuperAdminGuard implements CanActivate {
  constructor(private readonly usersService: UsersService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = await this.usersService.findById(request.user.userId);
    if (!user?.isSuperAdmin) {
      throw new ForbiddenException(
        'Chỉ tài khoản chủ hệ thống mới có quyền thực hiện thao tác này',
      );
    }
    return true;
  }
}

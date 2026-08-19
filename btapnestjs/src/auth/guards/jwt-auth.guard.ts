import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { verifyCustomJwt } from '../custom-jwt.util';
import { AuthUser } from '../types/auth-user.interface';

// BE-03: xác thực access token bằng JWT tự triển khai (custom-jwt.util.ts), không dùng
// passport-jwt/@nestjs/jwt để verify — thay hẳn cho JwtStrategy trước đây.
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();

    const authHeader = request.headers.authorization;
    const token = authHeader?.startsWith('Bearer ')
      ? authHeader.slice('Bearer '.length)
      : undefined;
    if (!token) {
      throw new UnauthorizedException('INVALID_TOKEN');
    }

    const secret = this.configService.getOrThrow<string>('JWT_SECRET');
    const decoded = verifyCustomJwt(token, secret);
    if (!decoded) {
      throw new UnauthorizedException('TOKEN_EXPIRED');
    }

    request.user = {
      userId: decoded.sub,
      username: decoded.username as string,
      email: decoded.email as string,
      role: decoded.role as string,
    };
    return true;
  }
}

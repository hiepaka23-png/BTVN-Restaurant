import { Module } from '@nestjs/common';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { MailModule } from '../mail/mail.module';

// BE-03: JWT (access + refresh) đều được ký/xác thực bằng code tự viết trong custom-jwt.util.ts —
// không còn cần @nestjs/jwt / passport / passport-jwt cho luồng xác thực nữa.
@Module({
  imports: [UsersModule, MailModule],
  controllers: [AuthController],
  providers: [AuthService],
})
export class AuthModule {}

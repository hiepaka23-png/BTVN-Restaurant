import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { randomInt, createHash } from 'crypto';
import { UsersService } from '../users/users.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import {
  RequestPasswordResetDto,
  ResetPasswordDto,
  VerifyPasswordResetDto,
} from './dto/forgot-password.dto';
import { signCustomJwt, verifyCustomJwt } from './custom-jwt.util';
import { User } from '../users/user.schema';
import { MailService } from '../mail/mail.service';

const ACCESS_TOKEN_TTL_SECONDS = 10 * 60; // 10 phút
const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 ngày
const RESET_TOKEN_TTL_MINUTES = 15;

// Dùng chung cho cả lúc chặn đăng nhập lẫn lúc đá tài khoản đang có phiên hoạt động (SSE event
// 'user_banned', xem notification-service.ts phía frontend) — cùng 1 câu để nhất quán.
export const BANNED_ACCOUNT_MESSAGE =
  'Tài khoản của bạn đã bị ban, vui lòng liên hệ tổng đài 1900 2211 để được hỗ trợ.';

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Mã 6 chữ số kiểu OTP — dễ đọc/nhập tay hơn nhiều so với token hex dài, phù hợp cho người
// dùng tự gõ vào ô "Mã khôi phục" (trước đó dùng token hex 64 ký tự bị tràn ô nhập trên UI).
function generateResetCode(): string {
  return String(randomInt(100000, 1000000));
}

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

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private configService: ConfigService,
    private mailService: MailService,
  ) {}

  private async issueTokens(user: User) {
    const claims = {
      sub: String(user._id),
      username: user.username,
      email: user.email,
      role: user.role,
    };
    const accessSecret = this.configService.getOrThrow<string>('JWT_SECRET');
    const accessToken = signCustomJwt(
      claims,
      accessSecret,
      ACCESS_TOKEN_TTL_SECONDS,
    );

    const refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const refreshToken = signCustomJwt(
      { sub: String(user._id) },
      refreshSecret,
      REFRESH_TOKEN_TTL_SECONDS,
    );
    await this.usersService.setRefreshTokenHash(
      String(user._id),
      await bcrypt.hash(refreshToken, 10),
    );

    return { access_token: accessToken, refresh_token: refreshToken };
  }

  async login(dto: LoginDto) {
    // identifier có thể là email hoặc username — thử email trước (đa số trường hợp), rồi username.
    const user =
      (await this.usersService.findByEmail(dto.identifier)) ??
      (await this.usersService.findByUsername(dto.identifier));
    const passwordMatches =
      user && (await bcrypt.compare(dto.password, user.password));
    if (!user || !passwordMatches) {
      throw new UnauthorizedException('Tài khoản hoặc mật khẩu không đúng');
    }
    if (user.isBanned) {
      throw new ForbiddenException(BANNED_ACCOUNT_MESSAGE);
    }

    return { ...(await this.issueTokens(user)), user: toPublicUser(user) };
  }

  async register(dto: RegisterDto) {
    const [existingEmail, existingUsername] = await Promise.all([
      this.usersService.findByEmail(dto.email),
      this.usersService.findByUsername(dto.username),
    ]);
    if (existingEmail || existingUsername) {
      throw new ConflictException('Email hoặc username đã tồn tại');
    }

    const newUser = await this.usersService.create(dto);
    return {
      ...(await this.issueTokens(newUser)),
      user: toPublicUser(newUser),
    };
  }

  async refresh(refreshToken: string) {
    const refreshSecret =
      this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');
    const decoded = verifyCustomJwt(refreshToken, refreshSecret);
    if (!decoded) {
      throw new UnauthorizedException(
        'Refresh token không hợp lệ hoặc đã hết hạn',
      );
    }

    const user = await this.usersService.findById(decoded.sub);
    if (!user?.refreshTokenHash) {
      throw new UnauthorizedException('Refresh token đã bị thu hồi');
    }
    const matches = await bcrypt.compare(refreshToken, user.refreshTokenHash);
    if (!matches) {
      throw new UnauthorizedException('Refresh token không hợp lệ');
    }
    if (user.isBanned) {
      throw new ForbiddenException(BANNED_ACCOUNT_MESSAGE);
    }

    // Rotate: refresh token cũ bị vô hiệu hoá ngay khi cấp token mới.
    return this.issueTokens(user);
  }

  async logout(userId: string): Promise<void> {
    await this.usersService.setRefreshTokenHash(userId, null);
  }

  async requestPasswordReset(dto: RequestPasswordResetDto) {
    const user = await this.usersService.findByEmail(dto.email);
    // Báo lỗi rõ ràng thay vì phản hồi im lặng — đổi lấy trải nghiệm dễ debug hơn (đánh đổi:
    // để lộ việc một email có tồn tại tài khoản hay không, chấp nhận được cho phạm vi đồ án).
    if (!user) {
      throw new NotFoundException('Không tìm thấy tài khoản với email này');
    }

    const token = generateResetCode();
    const expiresAt = new Date(
      Date.now() + RESET_TOKEN_TTL_MINUTES * 60 * 1000,
    );
    await this.usersService.setResetToken(
      dto.email,
      hashToken(token),
      expiresAt,
    );

    // Có cấu hình Gmail thì gửi email thật; nếu chưa cấu hình hoặc gửi thất bại thì rơi về chế độ
    // demo (log ra console + trả kèm devToken trong response để tự test được luồng không cần inbox).
    const emailSent = await this.mailService.sendPasswordResetCode(
      dto.email,
      token,
    );
    if (emailSent) {
      return { message: 'Đã gửi mã đặt lại mật khẩu, vui lòng kiểm tra email' };
    }

    console.log(
      `[forgot-password] Mã đặt lại mật khẩu cho ${dto.email}: ${token}`,
    );
    const isProd = this.configService.get<string>('NODE_ENV') === 'production';
    return {
      message: this.mailService.isConfigured()
        ? 'Gửi email thất bại, đây là mã dự phòng để bạn tiếp tục demo'
        : 'Chưa cấu hình dịch vụ gửi email thật — đây là mã demo',
      // Chỉ trả token ra ngoài khi KHÔNG chạy production, phục vụ demo không có email server thật.
      ...(isProd ? {} : { devToken: token }),
    };
  }

  async verifyPasswordReset(dto: VerifyPasswordResetDto) {
    const user = await this.usersService.findByEmail(dto.email);
    const isValid = this.isResetTokenValid(user, dto.token);
    if (!isValid) {
      throw new BadRequestException(
        'Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
      );
    }
    return { valid: true };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);
    if (!this.isResetTokenValid(user, dto.token) || !user) {
      throw new BadRequestException(
        'Mã đặt lại mật khẩu không hợp lệ hoặc đã hết hạn',
      );
    }

    await this.usersService.updatePasswordById(
      String(user._id),
      dto.newPassword,
    );
    await this.usersService.clearResetToken(String(user._id));
    // Đổi mật khẩu xong thì thu hồi luôn mọi refresh token đang có.
    await this.usersService.setRefreshTokenHash(String(user._id), null);

    return { message: 'Đặt lại mật khẩu thành công' };
  }

  private isResetTokenValid(user: User | null, token: string): boolean {
    if (!user?.resetTokenHash || !user.resetTokenExpiresAt) return false;
    if (user.resetTokenExpiresAt.getTime() < Date.now()) return false;
    return user.resetTokenHash === hashToken(token);
  }
}

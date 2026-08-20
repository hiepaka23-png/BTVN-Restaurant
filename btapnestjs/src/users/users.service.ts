import {
  BadRequestException,
  Injectable,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { randomInt, createHash } from 'crypto';
import { User } from './user.schema';
import { RegisterDto } from '../auth/dto/register.dto';
import { MailService } from '../mail/mail.service';

// Username của tài khoản chủ hệ thống — người DUY NHẤT có quyền ban/unban tài khoản khác. Không có
// cơ chế cấp quyền super admin qua API (khác với role 'admin' thường), chỉ đánh dấu một lần lúc
// server khởi động (xem onModuleInit bên dưới).
const SUPER_ADMIN_USERNAME = 'hiepaka';

const SALT_ROUNDS = 10;
const DELETE_TOKEN_TTL_MINUTES = 10;

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// Mã 6 chữ số kiểu OTP, giống hệt luồng quên mật khẩu — dễ nhập tay hơn token hex dài.
function generateDeleteCode(): string {
  return String(randomInt(100000, 1000000));
}

@Injectable()
export class UsersService implements OnModuleInit {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly mailService: MailService,
  ) {}

  // Đảm bảo tài khoản chủ hệ thống luôn có isSuperAdmin=true — chạy lại mỗi lần server khởi động
  // (idempotent, chỉ update nếu cần) thay vì chạy script thủ công một lần, vì môi trường deploy
  // (Render) không có cách thuận tiện để chạy migration script riêng.
  async onModuleInit(): Promise<void> {
    try {
      const result = await this.userModel
        .updateOne(
          { username: SUPER_ADMIN_USERNAME, isSuperAdmin: { $ne: true } },
          { isSuperAdmin: true },
        )
        .exec();
      if (result.modifiedCount > 0) {
        this.logger.log(`Đã đánh dấu "${SUPER_ADMIN_USERNAME}" là super admin.`);
      }
    } catch (error) {
      this.logger.error('Không thể bootstrap super admin', error as Error);
    }
  }

  async findByUsername(username: string): Promise<User | null> {
    return this.userModel.findOne({ username }).exec();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.userModel.findOne({ email: email.toLowerCase() }).exec();
  }

  async findById(id: string): Promise<User | null> {
    return this.userModel.findById(id).exec();
  }

  async create(user: RegisterDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
    const newUser = new this.userModel({
      username: user.username,
      email: user.email.toLowerCase(),
      name: user.name,
      password: hashedPassword,
    });
    return newUser.save();
  }

  async updateProfile(
    id: string,
    updates: { name?: string; email?: string; avatarUrl?: string },
  ): Promise<User | null> {
    const patch: Partial<User> = { ...updates };
    if (updates.email) {
      patch.email = updates.email.toLowerCase();
    }
    return this.userModel.findByIdAndUpdate(id, patch, { new: true }).exec();
  }

  async updatePasswordById(id: string, newPassword: string): Promise<void> {
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.userModel
      .findByIdAndUpdate(id, { password: hashedPassword })
      .exec();
  }

  async changePassword(
    id: string,
    currentPassword: string,
    newPassword: string,
  ): Promise<void> {
    const user = await this.userModel.findById(id).exec();
    const matches =
      user && (await bcrypt.compare(currentPassword, user.password));
    if (!user || !matches) {
      throw new BadRequestException('Mật khẩu hiện tại không đúng');
    }
    await this.updatePasswordById(id, newPassword);
  }

  async updatePassword(
    username: string,
    newPassword: string,
  ): Promise<User | null> {
    const hashedPassword = await bcrypt.hash(newPassword, SALT_ROUNDS);
    return this.userModel
      .findOneAndUpdate(
        { username },
        { password: hashedPassword },
        { new: true },
      )
      .exec();
  }

  // Chống trường hợp kẻ gian chiếm được phiên đăng nhập (access token) rồi xóa thẳng tài khoản:
  // bắt buộc phải có mã xác thực gửi qua email đăng ký trước khi xóa được (giống luồng OTP quên
  // mật khẩu), tách riêng field deleteTokenHash để không lẫn với token đặt lại mật khẩu.
  async requestAccountDeletion(
    id: string,
  ): Promise<{ message: string; devToken?: string }> {
    const user = await this.userModel.findById(id).exec();
    if (!user) {
      throw new BadRequestException('Không tìm thấy tài khoản');
    }

    const code = generateDeleteCode();
    const expiresAt = new Date(Date.now() + DELETE_TOKEN_TTL_MINUTES * 60 * 1000);
    await this.userModel
      .findByIdAndUpdate(id, {
        deleteTokenHash: hashToken(code),
        deleteTokenExpiresAt: expiresAt,
      })
      .exec();

    const emailSent = await this.mailService.sendAccountDeletionCode(
      user.email,
      code,
    );
    if (emailSent) {
      return { message: 'Đã gửi mã xác thực xóa tài khoản, vui lòng kiểm tra email' };
    }

    console.log(`[delete-account] Mã xác thực xóa tài khoản cho ${user.email}: ${code}`);
    return {
      message: this.mailService.isConfigured()
        ? 'Gửi email thất bại, đây là mã dự phòng để bạn tiếp tục demo'
        : 'Chưa cấu hình dịch vụ gửi email thật — đây là mã demo',
      devToken: code,
    };
  }

  async deleteById(id: string, token: string): Promise<void> {
    const user = await this.userModel.findById(id).exec();
    const isValid =
      user?.deleteTokenHash &&
      user.deleteTokenExpiresAt &&
      user.deleteTokenExpiresAt.getTime() >= Date.now() &&
      user.deleteTokenHash === hashToken(token);
    if (!isValid) {
      throw new BadRequestException(
        'Mã xác thực không hợp lệ hoặc đã hết hạn',
      );
    }

    await this.userModel.findByIdAndDelete(id).exec();
  }

  async setRefreshTokenHash(id: string, hash: string | null): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, { refreshTokenHash: hash })
      .exec();
  }

  async setResetToken(
    email: string,
    tokenHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.userModel
      .findOneAndUpdate(
        { email: email.toLowerCase() },
        { resetTokenHash: tokenHash, resetTokenExpiresAt: expiresAt },
      )
      .exec();
  }

  async clearResetToken(id: string): Promise<void> {
    await this.userModel
      .findByIdAndUpdate(id, {
        resetTokenHash: null,
        resetTokenExpiresAt: null,
      })
      .exec();
  }

  async findAll(keyword?: string, role?: string): Promise<User[]> {
    const filter: Record<string, unknown> = {};
    if (role) {
      filter.role = role;
    }
    if (keyword?.trim()) {
      const regex = new RegExp(keyword.trim(), 'i');
      filter.$or = [{ username: regex }, { email: regex }, { name: regex }];
    }
    return this.userModel.find(filter).sort({ createdAt: -1 }).exec();
  }

  async setRole(id: string, role: 'user' | 'admin'): Promise<User | null> {
    return this.userModel.findByIdAndUpdate(id, { role }, { new: true }).exec();
  }

  async setBanned(id: string, banned: boolean): Promise<User | null> {
    return this.userModel
      .findByIdAndUpdate(id, { isBanned: banned }, { new: true })
      .exec();
  }
}

import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import { User } from './user.schema';
import { RegisterDto } from '../auth/dto/register.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class UsersService {
  constructor(@InjectModel(User.name) private userModel: Model<User>) {}

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

  async deleteById(id: string): Promise<void> {
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
}

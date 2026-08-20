import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema({ timestamps: true })
export class User extends Document {
  @Prop({ required: true, unique: true })
  username: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  password: string;

  @Prop({ default: 'user' }) // Role mặc định là 'user', có thể là 'admin'
  role: string;

  @Prop({ default: '' })
  avatarUrl: string;

  // Hash của refresh token hiện hành — cho phép thu hồi (BE-06) bằng cách xoá field này.
  @Prop({ type: String, default: null })
  refreshTokenHash: string | null;

  // Token đặt lại mật khẩu (US-03 / BE-04): lưu dạng hash, có hạn sử dụng.
  @Prop({ type: String, default: null })
  resetTokenHash: string | null;

  @Prop({ type: Date, default: null })
  resetTokenExpiresAt: Date | null;

  // Mã xác thực xóa tài khoản gửi qua email — tách riêng khỏi resetToken ở trên để mã đặt lại
  // mật khẩu không thể bị lợi dụng để xóa tài khoản (và ngược lại).
  @Prop({ type: String, default: null })
  deleteTokenHash: string | null;

  @Prop({ type: Date, default: null })
  deleteTokenExpiresAt: Date | null;
}

export const UserSchema = SchemaFactory.createForClass(User);

import { IsEmail, IsOptional, IsString, MinLength } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  // Đường dẫn tương đối trả về từ POST /uploads/avatar (vd: /uploads/abc.png).
  @IsOptional()
  @IsString()
  avatarUrl?: string;
}

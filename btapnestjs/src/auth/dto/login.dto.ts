import { IsNotEmpty, IsString } from 'class-validator';

export class LoginDto {
  // Chấp nhận email hoặc username — AuthService tự thử cả hai cách tra cứu.
  @IsString()
  @IsNotEmpty()
  identifier: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

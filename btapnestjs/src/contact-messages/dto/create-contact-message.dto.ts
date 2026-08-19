import { IsEmail, IsString, MinLength } from 'class-validator';

export class CreateContactMessageDto {
  @IsString()
  @MinLength(2, { message: 'Vui lòng nhập họ tên' })
  fullName: string;

  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsString()
  @MinLength(10, { message: 'Nội dung cần ít nhất 10 ký tự' })
  message: string;
}

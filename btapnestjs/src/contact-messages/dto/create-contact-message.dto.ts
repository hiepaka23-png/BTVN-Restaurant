import { IsEmail, IsIn, IsOptional, IsString, Matches, MinLength } from 'class-validator';

// Số điện thoại VN: bắt đầu bằng 0, theo sau 9-10 chữ số — khớp pattern dùng ở đặt bàn/đặt món.
const VN_PHONE_PATTERN = /^0\d{9,10}$/;

export const CONTACT_SUBJECTS = [
  'Đặt bàn / Đặt món',
  'Góp ý dịch vụ',
  'Khiếu nại',
  'Hợp tác kinh doanh',
  'Khác',
] as const;

export class CreateContactMessageDto {
  @IsString()
  @MinLength(2, { message: 'Vui lòng nhập họ tên' })
  fullName: string;

  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsOptional()
  @IsString()
  @Matches(VN_PHONE_PATTERN, {
    message: 'Số điện thoại phải bắt đầu bằng số 0 và chỉ gồm chữ số',
  })
  phone?: string;

  @IsIn(CONTACT_SUBJECTS, { message: 'Vui lòng chọn chủ đề' })
  subject: (typeof CONTACT_SUBJECTS)[number];

  @IsString()
  @MinLength(10, { message: 'Nội dung cần ít nhất 10 ký tự' })
  message: string;
}

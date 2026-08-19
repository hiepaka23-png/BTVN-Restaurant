import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

const VN_PHONE_PATTERN = /^0\d{9,10}$/;

export class CreateJobApplicationDto {
  @IsString()
  @MinLength(2, { message: 'Vui lòng nhập họ tên' })
  fullName: string;

  @IsEmail({}, { message: 'Email không hợp lệ' })
  email: string;

  @IsString()
  @Matches(VN_PHONE_PATTERN, {
    message: 'Số điện thoại phải bắt đầu bằng số 0 và chỉ gồm chữ số',
  })
  phone: string;

  @IsString()
  @MinLength(2, { message: 'Vui lòng chọn vị trí ứng tuyển' })
  position: string;

  @IsOptional()
  @IsString()
  message?: string;
}

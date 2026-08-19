import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
  MinLength,
} from 'class-validator';

const VN_PHONE_PATTERN = /^0\d{9,10}$/;

export class CreateReservationDto {
  @IsString()
  @MinLength(2, { message: 'Vui lòng nhập tên của bạn' })
  customerName: string;

  @IsString()
  @Matches(VN_PHONE_PATTERN, {
    message: 'Số điện thoại phải bắt đầu bằng số 0 và chỉ gồm chữ số',
  })
  phone: string;

  @IsString()
  @MinLength(1, { message: 'Vui lòng chọn ngày đặt bàn' })
  date: string;

  @IsString()
  @MinLength(1, { message: 'Vui lòng chọn giờ đặt bàn' })
  time: string;

  @IsInt()
  @Min(1, { message: 'Số khách phải lớn hơn 0' })
  guestCount: number;

  @IsOptional()
  @IsString()
  note?: string;
}

import { Type } from 'class-transformer';
import {
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';

// Giới hạn số lượng đặt tối đa cho mỗi món trong 1 đơn — tránh đặt số lượng bất hợp lý.
const MAX_QUANTITY_PER_ITEM = 50;

// Số điện thoại VN: bắt đầu bằng 0, theo sau 9-10 chữ số.
const VN_PHONE_PATTERN = /^0\d{9,10}$/;
// Địa chỉ: phải có cả chữ lẫn số.
const ADDRESS_PATTERN = /^(?=.*[a-zA-ZÀ-ỹ])(?=.*\d).+$/;

export class OrderItemDto {
  @IsNumber()
  recipeId: number;

  @IsString()
  name: string;

  @IsNumber()
  price: number;

  @IsNumber()
  @Min(1, { message: 'Số lượng phải từ 1 trở lên' })
  @Max(MAX_QUANTITY_PER_ITEM, { message: `Số lượng mỗi món tối đa ${MAX_QUANTITY_PER_ITEM}` })
  quantity: number;
}

export class CreateOrderDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'Giỏ hàng đang trống' })
  @ValidateNested({ each: true })
  @Type(() => OrderItemDto)
  items: OrderItemDto[];

  @IsString()
  @MinLength(2, { message: 'Vui lòng nhập tên người nhận' })
  recipientName: string;

  @IsString()
  @Matches(VN_PHONE_PATTERN, {
    message: 'Số điện thoại phải bắt đầu bằng số 0 và chỉ gồm chữ số',
  })
  phone: string;

  @IsString()
  @MinLength(5, { message: 'Vui lòng nhập địa chỉ giao hàng' })
  @Matches(ADDRESS_PATTERN, { message: 'Địa chỉ cần có cả chữ và số' })
  address: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsIn(['cod', 'bank_transfer'], { message: 'Phương thức thanh toán không hợp lệ' })
  paymentMethod: 'cod' | 'bank_transfer';

  @IsOptional()
  @IsString()
  promoCode?: string;
}

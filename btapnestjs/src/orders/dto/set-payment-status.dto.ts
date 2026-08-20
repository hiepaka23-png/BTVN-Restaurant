import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { PaymentStatus } from '../schemas/order.schema';

export class SetPaymentStatusDto {
  @IsIn(Object.values(PaymentStatus))
  paymentStatus: PaymentStatus;

  // Chỉ có ý nghĩa khi chuyển sang 'da_thanh_toan' (mã tham chiếu giao dịch ngân hàng admin tự
  // nhập khi xác nhận đã nhận chuyển khoản) — không bắt buộc.
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transactionId?: string;
}

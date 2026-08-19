import { IsIn, IsNotEmpty, IsString, ValidateIf } from 'class-validator';
import { OrderStatus } from '../schemas/order.schema';

export class SetOrderStatusDto {
  @IsIn(Object.values(OrderStatus))
  status: OrderStatus;

  // Bắt buộc khi status = bi_huy (AD-03); bị bỏ qua ở các status khác.
  @ValidateIf((dto: SetOrderStatusDto) => dto.status === OrderStatus.BI_HUY)
  @IsString()
  @IsNotEmpty({ message: 'Phải nhập lý do huỷ đơn' })
  cancelReason?: string;
}

import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

// Mã ưu đãi trúng từ minigame "Hộp Quà May Mắn" — sinh và lưu ở server (không còn random thuần
// phía trình duyệt), nên giới hạn "1 lượt mở/ngày" và trạng thái "đã dùng mã hay chưa" đều là thật,
// không thể lách bằng cách xoá localStorage/đổi trình duyệt như bản cũ.
@Schema({ timestamps: true })
export class PromoCode {
  @Prop({ required: true })
  userId: string;

  @Prop({ required: true, unique: true })
  code: string;

  @Prop({ required: true })
  discountPercent: number;

  @Prop({ default: false })
  used: boolean;

  // Gắn với đơn hàng đã dùng mã này, chỉ mang tính tra cứu/đối chiếu.
  @Prop({ type: String, default: null })
  usedOrderId: string | null;
}

export type PromoCodeDocument = HydratedDocument<PromoCode>;
export const PromoCodeSchema = SchemaFactory.createForClass(PromoCode);

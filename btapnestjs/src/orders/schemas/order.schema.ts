import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export enum OrderStatus {
  DANG_LAM = 'dang_lam',
  HOAN_THANH = 'hoan_thanh',
  BI_HUY = 'bi_huy',
}

export enum PaymentMethod {
  COD = 'cod',
  BANK_TRANSFER = 'bank_transfer',
}

export enum PaymentStatus {
  CHUA_THANH_TOAN = 'chua_thanh_toan',
  DA_THANH_TOAN = 'da_thanh_toan',
}

@Schema({ _id: false })
export class OrderItem {
  @Prop({ required: true })
  recipeId: number;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  price: number;

  @Prop({ required: true })
  quantity: number;
}
export const OrderItemSchema = SchemaFactory.createForClass(OrderItem);

@Schema({ timestamps: true })
export class Order {
  // Chủ sở hữu thật của đơn — dùng ID cố định (không phải username) để tránh trường hợp US-14:
  // xoá tài khoản rồi đăng ký lại đúng username/email cũ vẫn có thể "thừa hưởng" nhầm đơn hàng
  // của tài khoản cũ (username có thể bị tái sử dụng, còn _id của user mới luôn khác).
  @Prop({ required: true })
  userId: string;

  // Giữ lại username lúc đặt đơn để hiển thị lịch sử cho admin (AD-01) — chỉ mang tính nhãn hiển
  // thị, KHÔNG dùng để xác định quyền sở hữu đơn.
  @Prop({ required: true })
  username: string;

  @Prop({ type: [OrderItemSchema], required: true })
  items: OrderItem[];

  @Prop({ required: true })
  total: number;

  @Prop({ required: true })
  recipientName: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  address: string;

  @Prop({ default: '' })
  note: string;

  @Prop({ enum: OrderStatus, default: OrderStatus.DANG_LAM })
  status: OrderStatus;

  // Bắt buộc có khi status = bi_huy (AD-03), hiển thị lại cho user tại US-11.
  @Prop({ type: String, default: null })
  cancelReason: string | null;

  // Chọn lúc đặt món, không đổi được sau đó (muốn đổi thì huỷ rồi đặt lại). Đơn tạo trước khi có
  // trường này mặc định COD — đúng thực tế vì trước đó hệ thống chỉ có duy nhất hình thức này.
  @Prop({ enum: PaymentMethod, default: PaymentMethod.COD })
  paymentMethod: PaymentMethod;

  // COD: hệ thống tự chuyển 'đã thanh toán' khi đơn hoàn tất (xem OrdersService.setStatus).
  // Chuyển khoản: không có cổng thanh toán thật nên admin xác nhận thủ công sau khi nhận được tiền.
  @Prop({ enum: PaymentStatus, default: PaymentStatus.CHUA_THANH_TOAN })
  paymentStatus: PaymentStatus;

  // Admin tự nhập khi xác nhận đã nhận chuyển khoản (mã tham chiếu giao dịch ngân hàng), không bắt buộc.
  @Prop({ type: String, default: null })
  transactionId: string | null;

  @Prop({ type: Date, default: null })
  paidAt: Date | null;

  // Mã ưu đãi trúng từ minigame Hộp Quà May Mắn, nếu đơn có áp dụng — xem PromoCodesService.
  // total ở trên đã là số tiền SAU khi trừ discountAmount (không cần FE tự tính lại).
  @Prop({ type: String, default: null })
  promoCode: string | null;

  @Prop({ default: 0 })
  discountPercent: number;

  @Prop({ default: 0 })
  discountAmount: number;
}

export type OrderDocument = HydratedDocument<Order>;
export const OrderSchema = SchemaFactory.createForClass(Order);

import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { PromoCode, PromoCodeDocument } from './schemas/promo-code.schema';

// Trọng số cao hơn -> xác suất trúng cao hơn (giữ đúng cảm giác "ưu đãi lớn hiếm hơn" như thiết kế
// minigame ban đầu). Chỉ dùng mức % vì đây là loại thưởng DUY NHẤT áp được thẳng vào tổng tiền đơn
// hàng thật — "miễn phí giao hàng"/"tặng món khai vị" ở bản cũ không có phí ship hay món cụ thể
// nào trong hệ thống để gán vào, nên không giữ lại (tránh phần thưởng trúng rồi không dùng được).
// 5 hộp quà tương ứng 4 mức thưởng (2 hộp cùng ra 10% — vẫn đủ 5 hộp để mở nhưng chỉ có 4 loại
// thưởng khác nhau): 10%/15%/20% phổ biến dần hiếm, 50% là hộp đặc biệt cực hiếm.
const DISCOUNT_TIERS: { percent: number; weight: number }[] = [
  { percent: 10, weight: 40 },
  { percent: 15, weight: 30 },
  { percent: 20, weight: 20 },
  { percent: 50, weight: 10 },
];

function pickWeightedDiscount(): number {
  const totalWeight = DISCOUNT_TIERS.reduce((sum, t) => sum + t.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const tier of DISCOUNT_TIERS) {
    roll -= tier.weight;
    if (roll <= 0) return tier.percent;
  }
  return DISCOUNT_TIERS[0].percent;
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // bỏ ký tự dễ nhầm (0/O, 1/I)
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return `LUCKY-${code}`;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

@Injectable()
export class PromoCodesService {
  constructor(
    @InjectModel(PromoCode.name)
    private readonly promoCodeModel: Model<PromoCodeDocument>,
  ) {}

  async getTodayCode(userId: string): Promise<PromoCode | null> {
    return this.promoCodeModel
      .findOne({ userId, createdAt: { $gte: startOfToday() } })
      .lean();
  }

  // Idempotent: đã mở hôm nay rồi thì trả lại đúng mã cũ thay vì tạo mã mới hay báo lỗi — khớp
  // hành vi "đã nhận quà hôm nay" của giao diện.
  async claimDaily(userId: string): Promise<PromoCode> {
    const existing = await this.getTodayCode(userId);
    if (existing) {
      return existing;
    }

    let code = generateCode();
    // Không gian mã ~32^6 nên gần như không bao giờ trùng, nhưng vẫn thử lại cho chắc vì code là
    // unique index — tránh ném lỗi duplicate key hiếm gặp lên tận người dùng.
    for (let attempt = 0; attempt < 5; attempt++) {
      const clash = await this.promoCodeModel.exists({ code });
      if (!clash) break;
      code = generateCode();
    }

    const created = await this.promoCodeModel.create({
      userId,
      code,
      discountPercent: pickWeightedDiscount(),
    });
    return created.toObject();
  }

  // Dùng lúc đặt đơn: khoá mã ngay lập tức (atomic) theo đúng chủ sở hữu + chưa dùng, tránh trường
  // hợp gọi 2 lần cùng lúc dùng được 1 mã 2 lần. Trả về null nếu mã không hợp lệ/không phải của
  // người đang đặt/đã dùng rồi — OrdersService tự quyết định báo lỗi gì cho phù hợp.
  async consume(
    userId: string,
    code: string,
    orderId: string,
  ): Promise<PromoCode | null> {
    return this.promoCodeModel
      .findOneAndUpdate(
        { userId, code: code.trim().toUpperCase(), used: false },
        { used: true, usedOrderId: orderId },
      )
      .lean();
  }
}

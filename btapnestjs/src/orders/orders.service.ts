import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import {
  Order,
  OrderDocument,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
} from './schemas/order.schema';
import { NotificationsService } from '../notifications/notifications.service';
import { PromoCodesService } from '../promo-codes/promo-codes.service';

const DEFAULT_CANCEL_REASON = 'Huỷ bởi khách hàng';
const REVENUE_HISTORY_DAYS = 14;

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly notificationsService: NotificationsService,
    private readonly promoCodesService: PromoCodesService,
  ) {}

  async create(
    userId: string,
    username: string,
    dto: CreateOrderDto,
  ): Promise<Order> {
    const subtotal = dto.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );

    // Sinh sẵn _id để có thể khoá mã ưu đãi (nếu có) gắn liền với đơn này TRƯỚC khi tạo document —
    // tránh 1 mã bị dùng 2 lần nếu 2 request đặt đơn chạy song song.
    const orderId = new Types.ObjectId();

    let discountPercent = 0;
    let discountAmount = 0;
    let promoCode: string | null = null;

    if (dto.promoCode) {
      const promo = await this.promoCodesService.consume(
        userId,
        dto.promoCode,
        orderId.toString(),
      );
      if (!promo) {
        throw new BadRequestException(
          'Mã giảm giá không hợp lệ hoặc đã được sử dụng',
        );
      }
      discountPercent = promo.discountPercent;
      discountAmount = Math.round((subtotal * discountPercent) / 100);
      promoCode = promo.code;
    }

    const total = subtotal - discountAmount;

    const created = await this.orderModel.create({
      _id: orderId,
      userId,
      username,
      items: dto.items,
      total,
      recipientName: dto.recipientName.trim(),
      phone: dto.phone.trim(),
      address: dto.address.trim(),
      note: dto.note?.trim() ?? '',
      paymentMethod: dto.paymentMethod as PaymentMethod,
      promoCode,
      discountPercent,
      discountAmount,
    });
    const order = created.toObject();
    this.notificationsService.emitOrderCreated(order);
    return order;
  }

  async findAll(): Promise<Order[]> {
    const orders = await this.orderModel.find().sort({ createdAt: -1 }).lean();
    return orders.map((o) => this.withPaymentDefaults(o));
  }

  async findByUserId(userId: string): Promise<Order[]> {
    const orders = await this.orderModel
      .find({ userId })
      .sort({ createdAt: -1 })
      .lean();
    return orders.map((o) => this.withPaymentDefaults(o));
  }

  // .lean() trả thẳng document Mongo gốc, KHÔNG tự áp default của schema cho field còn thiếu —
  // nên đơn tạo trước khi có các trường thanh toán (paymentMethod/paymentStatus...) sẽ thiếu hẳn
  // các key này trong kết quả trả về. Tự điền default ở đây để FE luôn nhận đủ field, tương đương
  // hành vi mặc định COD/chưa thanh toán đã mô tả ở schema.
  private withPaymentDefaults(order: Order): Order {
    return {
      ...order,
      paymentMethod: order.paymentMethod ?? PaymentMethod.COD,
      paymentStatus: order.paymentStatus ?? PaymentStatus.CHUA_THANH_TOAN,
      transactionId: order.transactionId ?? null,
      paidAt: order.paidAt ?? null,
      promoCode: order.promoCode ?? null,
      discountPercent: order.discountPercent ?? 0,
      discountAmount: order.discountAmount ?? 0,
    };
  }

  private async findOwnedEditableOrder(
    id: string,
    userId: string,
  ): Promise<OrderDocument> {
    const order = await this.orderModel.findById(id).exec();
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');
    if (order.userId !== userId) {
      throw new ForbiddenException('Bạn không có quyền với đơn hàng này');
    }
    if (order.status !== OrderStatus.DANG_LAM) {
      throw new BadRequestException(
        'Chỉ có thể chỉnh sửa/huỷ đơn khi đơn đang ở trạng thái Đang làm',
      );
    }
    return order;
  }

  async updateOwn(
    id: string,
    userId: string,
    dto: UpdateOrderDto,
  ): Promise<Order> {
    const order = await this.findOwnedEditableOrder(id, userId);

    if (dto.items) {
      order.items = dto.items;
      const subtotal = dto.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
      // Giữ nguyên % giảm giá đã khoá lúc đặt đơn (không cho đổi mã qua bước sửa đơn), chỉ tính
      // lại số tiền giảm theo tổng tiền món mới.
      order.discountAmount = Math.round(
        (subtotal * order.discountPercent) / 100,
      );
      order.total = subtotal - order.discountAmount;
    }
    if (dto.recipientName) order.recipientName = dto.recipientName.trim();
    if (dto.phone) order.phone = dto.phone.trim();
    if (dto.address) order.address = dto.address.trim();
    if (dto.note !== undefined) order.note = dto.note.trim();

    await order.save();
    return order.toObject();
  }

  async cancelOwn(
    id: string,
    userId: string,
    reason?: string,
  ): Promise<Order> {
    const order = await this.findOwnedEditableOrder(id, userId);
    order.status = OrderStatus.BI_HUY;
    order.cancelReason = reason?.trim() || DEFAULT_CANCEL_REASON;
    await order.save();
    const plain = order.toObject();
    this.notificationsService.emitOrderStatusChanged(plain);
    return plain;
  }

  async setStatus(
    id: string,
    status: OrderStatus,
    cancelReason?: string,
  ): Promise<Order> {
    const order = await this.orderModel.findById(id).exec();
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

    order.status = status;
    order.cancelReason =
      status === OrderStatus.BI_HUY ? (cancelReason ?? '') : null;

    // COD: khách trả tiền khi nhận món, nên đơn hoàn tất coi như đã thanh toán luôn — không cần
    // admin xác nhận thêm bước riêng. Chuyển khoản thì KHÔNG tự đổi ở đây vì tiền có thể đã vào
    // tài khoản từ trước lúc đơn hoàn tất (hoặc chưa) — admin xác nhận thủ công qua endpoint riêng.
    if (
      status === OrderStatus.HOAN_THANH &&
      order.paymentMethod === 'cod' &&
      order.paymentStatus !== PaymentStatus.DA_THANH_TOAN
    ) {
      order.paymentStatus = PaymentStatus.DA_THANH_TOAN;
      order.paidAt = new Date();
    }

    await order.save();
    const plain = order.toObject();
    this.notificationsService.emitOrderStatusChanged(plain);
    return plain;
  }

  // Admin xác nhận/huỷ xác nhận đã nhận thanh toán — chủ yếu dùng cho đơn chuyển khoản (không có
  // cổng thanh toán thật để tự động xác nhận), nhưng không giới hạn chỉ method đó để admin vẫn có
  // thể chỉnh tay nếu cần.
  async setPaymentStatus(
    id: string,
    paymentStatus: PaymentStatus,
    transactionId?: string,
  ): Promise<Order> {
    const order = await this.orderModel.findById(id).exec();
    if (!order) throw new NotFoundException('Không tìm thấy đơn hàng');

    order.paymentStatus = paymentStatus;
    order.paidAt = paymentStatus === PaymentStatus.DA_THANH_TOAN ? new Date() : null;
    if (transactionId !== undefined) {
      order.transactionId = transactionId.trim() || null;
    }

    await order.save();
    const plain = order.toObject();
    this.notificationsService.emitOrderStatusChanged(plain);
    return plain;
  }

  // Số lượng đã đặt theo từng recipeId (không tính đơn Bị huỷ) — dùng để sắp xếp "phổ biến nhất"
  // ở trang danh sách món, mở cho mọi người dùng đã đăng nhập (không chỉ admin) vì đây là thông
  // tin hiển thị công khai trên thực đơn.
  async popularityByRecipe(): Promise<Record<number, number>> {
    const rows = await this.orderModel.aggregate<{
      _id: number;
      quantity: number;
    }>([
      { $match: { status: { $ne: OrderStatus.BI_HUY } } },
      { $unwind: '$items' },
      {
        $group: {
          _id: '$items.recipeId',
          quantity: { $sum: '$items.quantity' },
        },
      },
    ]);
    return Object.fromEntries(rows.map((r) => [r._id, r.quantity]));
  }

  async stats() {
    const since = new Date();
    since.setDate(since.getDate() - (REVENUE_HISTORY_DAYS - 1));
    since.setHours(0, 0, 0, 0);

    const [byStatus, topRecipes, total, revenueByDayRaw, revenueTotalRaw] =
      await Promise.all([
        this.orderModel.aggregate<{ _id: OrderStatus; count: number }>([
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ]),
        this.orderModel.aggregate<{ _id: string; quantity: number }>([
          { $unwind: '$items' },
          {
            $group: {
              _id: '$items.name',
              quantity: { $sum: '$items.quantity' },
            },
          },
          { $sort: { quantity: -1 } },
          { $limit: 5 },
        ]),
        this.orderModel.countDocuments(),
        // Doanh thu tính trên đơn KHÔNG bị huỷ (đang làm + hoàn thành), gộp theo ngày tạo đơn.
        this.orderModel.aggregate<{
          _id: string;
          revenue: number;
          orders: number;
        }>([
          {
            $match: {
              status: { $ne: OrderStatus.BI_HUY },
              createdAt: { $gte: since },
            },
          },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m-%d', date: '$createdAt' },
              },
              revenue: { $sum: '$total' },
              orders: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
        ]),
        this.orderModel.aggregate<{ _id: null; revenue: number }>([
          { $match: { status: { $ne: OrderStatus.BI_HUY } } },
          { $group: { _id: null, revenue: { $sum: '$total' } } },
        ]),
      ]);

    // Lấp đủ mọi ngày trong khoảng (kể cả ngày không có đơn nào) để biểu đồ không bị đứt quãng.
    const revenueByDate = new Map(
      revenueByDayRaw.map((r) => [
        r._id,
        { revenue: r.revenue, orders: r.orders },
      ]),
    );
    const revenueByDay: { date: string; revenue: number; orders: number }[] =
      [];
    for (let i = 0; i < REVENUE_HISTORY_DAYS; i++) {
      const day = new Date(since);
      day.setDate(day.getDate() + i);
      const key = day.toISOString().slice(0, 10);
      const entry = revenueByDate.get(key);
      revenueByDay.push({
        date: key,
        revenue: entry?.revenue ?? 0,
        orders: entry?.orders ?? 0,
      });
    }

    return {
      total,
      byStatus: Object.fromEntries(
        Object.values(OrderStatus).map((status) => [
          status,
          byStatus.find((s) => s._id === status)?.count ?? 0,
        ]),
      ),
      topRecipes: topRecipes.map((r) => ({
        name: r._id,
        quantity: r.quantity,
      })),
      totalRevenue: revenueTotalRaw[0]?.revenue ?? 0,
      revenueByDay,
    };
  }
}

import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateOrderDto } from './dto/create-order.dto';
import { UpdateOrderDto } from './dto/update-order.dto';
import { Order, OrderDocument, OrderStatus } from './schemas/order.schema';
import { NotificationsService } from '../notifications/notifications.service';

const DEFAULT_CANCEL_REASON = 'Huỷ bởi khách hàng';
const REVENUE_HISTORY_DAYS = 14;

@Injectable()
export class OrdersService {
  constructor(
    @InjectModel(Order.name) private readonly orderModel: Model<OrderDocument>,
    private readonly notificationsService: NotificationsService,
  ) {}

  async create(
    userId: string,
    username: string,
    dto: CreateOrderDto,
  ): Promise<Order> {
    const total = dto.items.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0,
    );
    const created = await this.orderModel.create({
      userId,
      username,
      items: dto.items,
      total,
      recipientName: dto.recipientName.trim(),
      phone: dto.phone.trim(),
      address: dto.address.trim(),
      note: dto.note?.trim() ?? '',
    });
    const order = created.toObject();
    this.notificationsService.emitOrderCreated(order);
    return order;
  }

  findAll(): Promise<Order[]> {
    return this.orderModel.find().sort({ createdAt: -1 }).lean();
  }

  findByUserId(userId: string): Promise<Order[]> {
    return this.orderModel.find({ userId }).sort({ createdAt: -1 }).lean();
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
      order.total = dto.items.reduce(
        (sum, item) => sum + item.price * item.quantity,
        0,
      );
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
    await order.save();
    const plain = order.toObject();
    this.notificationsService.emitOrderStatusChanged(plain);
    return plain;
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

import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Order, OrderStats, OrderStatus, PaymentMethod, PaymentStatus } from './models';
import { API_ORIGIN } from './api-config';

export const ORDERS_API_URL = `${API_ORIGIN}/orders`;

export interface CreateOrderPayload {
  items: { recipeId: number; name: string; price: number; quantity: number }[];
  recipientName: string;
  phone: string;
  address: string;
  note?: string;
  paymentMethod: PaymentMethod;
  promoCode?: string;
}

// Bao phủ toàn bộ API /orders: đặt món & tự quản đơn của người dùng (role 'user'), cộng với các
// thao tác admin-only (xem tất cả đơn, đổi trạng thái, thống kê). Backend tự chặn theo role/quyền
// sở hữu — service này chỉ gọi API, không tự kiểm tra quyền ở client.
@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient);

  createOrder(payload: CreateOrderPayload): Promise<Order> {
    return firstValueFrom(this.http.post<Order>(ORDERS_API_URL, payload));
  }

  getMyOrders(): Promise<Order[]> {
    return firstValueFrom(this.http.get<Order[]>(`${ORDERS_API_URL}/me`));
  }

  updateOrder(id: string, changes: Partial<CreateOrderPayload>): Promise<Order> {
    return firstValueFrom(this.http.patch<Order>(`${ORDERS_API_URL}/${id}`, changes));
  }

  cancelOrder(id: string, reason?: string): Promise<Order> {
    return firstValueFrom(this.http.patch<Order>(`${ORDERS_API_URL}/${id}/cancel`, { reason }));
  }

  // Số lượng đã đặt theo từng recipeId (recipeId -> tổng số lượng) — dùng để sắp xếp "phổ biến
  // nhất" ở trang danh sách món. Mở cho mọi người dùng đã đăng nhập, không chỉ admin.
  getPopularity(): Promise<Record<number, number>> {
    return firstValueFrom(this.http.get<Record<number, number>>(`${ORDERS_API_URL}/popularity`));
  }

  // --- Admin only (backend enforces the role check) ---

  getAllOrders(): Promise<Order[]> {
    return firstValueFrom(this.http.get<Order[]>(ORDERS_API_URL));
  }

  updateOrderStatus(id: string, status: OrderStatus, cancelReason?: string): Promise<Order> {
    return firstValueFrom(
      this.http.patch<Order>(`${ORDERS_API_URL}/${id}/status`, { status, cancelReason }),
    );
  }

  // Chủ yếu dùng cho đơn chuyển khoản: admin xác nhận đã nhận tiền (không có cổng thanh toán thật
  // để tự động xác nhận). Đơn COD tự chuyển "đã thanh toán" khi hoàn tất, không cần gọi API này.
  setPaymentStatus(id: string, paymentStatus: PaymentStatus, transactionId?: string): Promise<Order> {
    return firstValueFrom(
      this.http.patch<Order>(`${ORDERS_API_URL}/${id}/payment-status`, { paymentStatus, transactionId }),
    );
  }

  getStats(): Promise<OrderStats> {
    return firstValueFrom(this.http.get<OrderStats>(`${ORDERS_API_URL}/stats`));
  }
}

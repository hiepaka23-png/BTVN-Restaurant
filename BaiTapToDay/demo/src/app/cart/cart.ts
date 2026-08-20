import { Component, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormGroupDirective, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatRadioModule } from '@angular/material/radio';

import { CartService, MAX_QUANTITY_PER_ITEM } from '../cart-service';
import { OrderService } from '../order-service';
import { AuthService } from '../auth-service';
import { PromoService } from '../promo-service';
import { NAME_PATTERN, VN_PHONE_PATTERN, ADDRESS_PATTERN } from '../validators';
import { BackLink } from '../back-link/back-link';
import { AutofillSyncDirective } from '../autofill-sync-directive';
import { resolveImageUrl } from '../api-config';

@Component({
  selector: 'app-cart',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatRadioModule,
    BackLink,
    AutofillSyncDirective,
  ],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
})
export class CartPage {
  protected readonly cart = inject(CartService);
  protected readonly maxQuantityPerItem = MAX_QUANTITY_PER_ITEM;
  protected readonly resolveImageUrl = resolveImageUrl;
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly orderService = inject(OrderService);
  private readonly promoService = inject(PromoService);
  private readonly router = inject(Router);

  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly submitting = signal(false);

  // Cần lấy FormGroupDirective để reset đúng cách sau khi đặt món thành công — xem ghi chú chi
  // tiết trong reservation.ts.
  private readonly deliveryFormDirective = viewChild<FormGroupDirective>('deliveryFormDirective');

  protected readonly deliveryForm: FormGroup = this.fb.group({
    recipientName: ['', [Validators.required, Validators.minLength(2), Validators.pattern(NAME_PATTERN)]],
    phone: ['', [Validators.required, Validators.pattern(VN_PHONE_PATTERN)]],
    address: ['', [Validators.required, Validators.minLength(5), Validators.pattern(ADDRESS_PATTERN)]],
    note: [''],
    paymentMethod: ['cod', Validators.required],
  });

  // Mã ưu đãi — hoặc mã công khai quảng cáo trên thanh chạy chữ trang chủ, hoặc mã riêng trúng từ
  // Hộp Quà May Mắn — kiểm tra thật với server (GET /promo-codes/preview), không tự tính giảm giá
  // ở client rồi tin luôn. Backend vẫn tự xác minh + khoá mã lại lúc tạo đơn (xem
  // OrdersService.create), preview ở đây chỉ để người dùng thấy trước số tiền được giảm.
  protected readonly promoCodeInput = signal('');
  protected readonly appliedPromo = signal<{ code: string; discountPercent: number } | null>(null);
  protected readonly promoError = signal('');
  protected readonly checkingPromo = signal(false);

  protected readonly discountAmount = computed(() => {
    const promo = this.appliedPromo();
    if (!promo) {
      return 0;
    }
    return Math.round((this.cart.totalPrice() * promo.discountPercent) / 100);
  });

  protected readonly finalTotal = computed(() => this.cart.totalPrice() - this.discountAmount());

  protected increase(recipeId: number, currentQuantity: number): void {
    this.cart.updateQuantity(recipeId, currentQuantity + 1);
  }

  protected decrease(recipeId: number, currentQuantity: number): void {
    this.cart.updateQuantity(recipeId, currentQuantity - 1);
  }

  protected formatPrice(value: number): string {
    return value.toLocaleString('vi-VN') + 'đ';
  }

  protected async applyPromoCode(): Promise<void> {
    const typed = this.promoCodeInput().trim().toUpperCase();
    this.promoError.set('');
    this.appliedPromo.set(null);
    if (!typed) {
      return;
    }

    this.checkingPromo.set(true);
    try {
      const promo = await this.promoService.previewCode(typed);
      if (!promo) {
        this.promoError.set('Mã không hợp lệ hoặc đã được sử dụng.');
        return;
      }
      this.appliedPromo.set(promo);
    } catch {
      this.promoError.set('Không kiểm tra được mã, vui lòng thử lại.');
    } finally {
      this.checkingPromo.set(false);
    }
  }

  protected removePromoCode(): void {
    this.appliedPromo.set(null);
    this.promoCodeInput.set('');
    this.promoError.set('');
  }

  protected async submitOrder(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (this.auth.isAdmin()) {
      this.errorMessage.set('Tài khoản quản trị không thể đặt món.');
      return;
    }

    if (this.cart.items().length === 0) {
      this.errorMessage.set('Giỏ hàng đang trống, vui lòng chọn món trước khi đặt món.');
      return;
    }

    if (this.deliveryForm.invalid) {
      this.deliveryForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    try {
      const promo = this.appliedPromo();
      const payload = {
        items: this.cart.items().map((item) => ({
          recipeId: item.recipeId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        ...this.deliveryForm.value,
        ...(promo ? { promoCode: promo.code } : {}),
      };
      await this.orderService.createOrder(payload);

      this.cart.clear();
      this.deliveryFormDirective()?.resetForm();
      this.removePromoCode();
      this.successMessage.set('Đặt món thành công! Đang chuyển tới trang đơn hàng của bạn...');
      setTimeout(() => this.router.navigate(['/orders']), 2000);
    } catch (error: any) {
      const serverMessage = error?.error?.message;
      const message = Array.isArray(serverMessage) ? serverMessage.join(', ') : serverMessage;
      this.errorMessage.set(message || 'Đặt món thất bại, vui lòng thử lại.');
    } finally {
      this.submitting.set(false);
    }
  }
}

import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

import { CartService, MAX_QUANTITY_PER_ITEM } from '../cart-service';
import { OrderService } from '../order-service';
import { AuthService } from '../auth-service';
import { NAME_PATTERN, VN_PHONE_PATTERN, ADDRESS_PATTERN } from '../validators';
import { BackLink } from '../back-link/back-link';
import { AutofillSyncDirective } from '../autofill-sync-directive';

@Component({
  selector: 'app-cart',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterLink,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    BackLink,
    AutofillSyncDirective,
  ],
  templateUrl: './cart.html',
  styleUrl: './cart.css',
})
export class CartPage {
  protected readonly cart = inject(CartService);
  protected readonly maxQuantityPerItem = MAX_QUANTITY_PER_ITEM;
  protected readonly auth = inject(AuthService);
  private readonly fb = inject(FormBuilder);
  private readonly orderService = inject(OrderService);
  private readonly router = inject(Router);

  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly submitting = signal(false);

  protected readonly deliveryForm: FormGroup = this.fb.group({
    recipientName: ['', [Validators.required, Validators.minLength(2), Validators.pattern(NAME_PATTERN)]],
    phone: ['', [Validators.required, Validators.pattern(VN_PHONE_PATTERN)]],
    address: ['', [Validators.required, Validators.minLength(5), Validators.pattern(ADDRESS_PATTERN)]],
    note: [''],
  });

  protected increase(recipeId: number, currentQuantity: number): void {
    this.cart.updateQuantity(recipeId, currentQuantity + 1);
  }

  protected decrease(recipeId: number, currentQuantity: number): void {
    this.cart.updateQuantity(recipeId, currentQuantity - 1);
  }

  protected formatPrice(value: number): string {
    return value.toLocaleString('vi-VN') + 'đ';
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
      const payload = {
        items: this.cart.items().map((item) => ({
          recipeId: item.recipeId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        ...this.deliveryForm.value,
      };
      await this.orderService.createOrder(payload);

      this.cart.clear();
      this.deliveryForm.reset();
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

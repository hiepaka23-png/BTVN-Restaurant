import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { VN_PHONE_PATTERN } from '../validators';
import { BackLink } from '../back-link/back-link';
import { AutofillSyncDirective } from '../autofill-sync-directive';

export const RESERVATIONS_API_URL = 'http://localhost:3000/reservations';

@Component({
  selector: 'app-reservation',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    BackLink,
    AutofillSyncDirective,
  ],
  templateUrl: './reservation.html',
  styleUrl: './reservation.css',
})
export class ReservationPage {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);

  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly submitting = signal(false);

  protected readonly form: FormGroup = this.fb.group({
    customerName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(VN_PHONE_PATTERN)]],
    date: ['', Validators.required],
    time: ['', Validators.required],
    guestCount: [2, [Validators.required, Validators.min(1)]],
    note: [''],
  });

  protected async submit(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    try {
      await firstValueFrom(this.http.post(RESERVATIONS_API_URL, this.form.value));
      this.successMessage.set('Đặt bàn thành công! Nhà hàng sẽ gọi điện xác nhận với bạn sớm nhất.');
      this.form.reset({ guestCount: 2 });
    } catch (error: any) {
      const serverMessage = error?.error?.message;
      const message = Array.isArray(serverMessage) ? serverMessage.join(', ') : serverMessage;
      this.errorMessage.set(message || 'Đặt bàn thất bại, vui lòng thử lại.');
    } finally {
      this.submitting.set(false);
    }
  }
}

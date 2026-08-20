import { Component, inject, signal, viewChild } from '@angular/core';
import { CommonModule, formatDate } from '@angular/common';
import { FormBuilder, FormGroup, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker'; // ➕ mới
import { MatSelectModule } from '@angular/material/select';
import { VN_PHONE_PATTERN } from '../validators';
import { AutofillSyncDirective } from '../autofill-sync-directive';
import { API_ORIGIN } from '../api-config';
import { BackLink } from '../back-link/back-link';

export const RESERVATIONS_API_URL = `${API_ORIGIN}/reservations`;

// Khung giờ cho phép đặt bàn — sửa lại danh sách này cho khớp giờ mở cửa thật của bạn.
const TIME_SLOTS: string[] = [
  '10:30', '11:00', '11:30', '12:00', '12:30', '13:00',
  '17:00', '17:30', '18:00', '18:30', '19:00', '19:30',
  '20:00', '20:30', '21:00', '21:30', '22:00',
];

// Số khách tối đa cho phép chọn qua dropdown — bàn > 10 khách thì nên gọi hotline thay vì đặt online.
const GUEST_OPTIONS: number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

@Component({
  selector: 'app-reservation',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatDatepickerModule,
    MatSelectModule,
    BackLink,
    AutofillSyncDirective,
  ],
  templateUrl: './reservation.html',
  styleUrl: './reservation.css',
})
export class ReservationPage {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);

  protected readonly timeSlots = TIME_SLOTS;     // ➕ mới
  protected readonly guestOptions = GUEST_OPTIONS; // ➕ mới
  protected readonly today = new Date(); 

  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly submitting = signal(false);

  // Cần lấy FormGroupDirective để reset đúng cách sau khi đặt bàn thành công — gọi thẳng
  // form.reset() chỉ xoá value/dirty/touched của các control, KHÔNG xoá cờ "submitted" trên
  // directive, nên ErrorStateMatcher mặc định của Material vẫn coi form là "đã submit" và hiện
  // lại lỗi "bắt buộc nhập" ngay sau khi reset dù không ai chạm vào form.
  private readonly formDirective = viewChild<FormGroupDirective>('reservationFormDirective');

  protected readonly form: FormGroup = this.fb.group({
    customerName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(VN_PHONE_PATTERN)]],
    date: [null as Date | null, Validators.required],
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
      const raw = this.form.value;
      const payload = {
        ...raw,
        // Chuyển Date -> chuỗi "yyyy-MM-dd" giống format input date cũ, backend không cần đổi gì.
        date: raw.date ? formatDate(raw.date, 'yyyy-MM-dd', 'en-US') : '',
      };
      await firstValueFrom(this.http.post(RESERVATIONS_API_URL, payload));
      this.successMessage.set('Đặt bàn thành công! Nhà hàng sẽ gọi điện xác nhận với bạn sớm nhất.');
      this.formDirective()?.resetForm({ guestCount: 2 });
    } catch (error: any) {
      const serverMessage = error?.error?.message;
      const message = Array.isArray(serverMessage) ? serverMessage.join(', ') : serverMessage;
      this.errorMessage.set(message || 'Đặt bàn thất bại, vui lòng thử lại.');
    } finally {
      this.submitting.set(false);
    }
  }
}

import { Component, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { BackLink } from '../back-link/back-link';
import { AutofillSyncDirective } from '../autofill-sync-directive';
import { VN_PHONE_PATTERN } from '../validators';
import { API_ORIGIN } from '../api-config';

export const CONTACT_MESSAGES_API_URL = `${API_ORIGIN}/contact-messages`;

// Khớp đúng danh sách CONTACT_SUBJECTS ở backend (create-contact-message.dto.ts) — sai chính tả/
// khác thứ tự đều khiến request bị 400 vì backend chỉ chấp nhận đúng các giá trị này.
const SUBJECT_OPTIONS = [
  'Đặt bàn / Đặt món',
  'Góp ý dịch vụ',
  'Khiếu nại',
  'Hợp tác kinh doanh',
  'Khác',
];

// Thông tin liên hệ tĩnh của nhà hàng — giữ đúng số liệu đã có sẵn trong project (không đổi theo
// ảnh tham khảo), "Giờ hoạt động" dùng chung khung giờ với trang Đặt bàn cho nhất quán toàn site.
const RESTAURANT_HOTLINE = '1900 0102';
const RESTAURANT_EMAIL = 'support@michelin5star.vn';
const RESTAURANT_HOURS = '10:30 – 22:30 (hằng ngày)';
const RESTAURANT_ADDRESS = '181 đường Cao Thắng, Phường Hòa Hưng, TP.HCM';

@Component({
  selector: 'app-contact',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    BackLink,
    AutofillSyncDirective,
  ],
  templateUrl: './contact.html',
  styleUrl: './contact.css',
})
export class ContactPage {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);
  private readonly sanitizer = inject(DomSanitizer);

  protected readonly subjectOptions = SUBJECT_OPTIONS;
  protected readonly hotline = RESTAURANT_HOTLINE;
  protected readonly contactEmail = RESTAURANT_EMAIL;
  protected readonly hours = RESTAURANT_HOURS;
  protected readonly address = RESTAURANT_ADDRESS;
  // Mở Google Maps tìm đúng địa chỉ — dùng URL tìm kiếm công khai, không cần API key/tích hợp bản
  // đồ nào (project chưa có map component/API riêng nào để tái sử dụng).
  protected readonly directionsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(RESTAURANT_ADDRESS)}`;

  // Nhúng bản đồ thật bằng URL "output=embed" công khai của Google Maps — không cần API key/billing
  // (khác với Maps Embed API chính thức). Phải bọc bypassSecurityTrustResourceUrl vì Angular chặn
  // src của iframe theo mặc định để chống XSS.
  protected readonly mapEmbedUrl: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
    `https://www.google.com/maps?q=${encodeURIComponent(RESTAURANT_ADDRESS)}&output=embed`,
  );

  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly submitting = signal(false);

  // Cần lấy FormGroupDirective để reset đúng cách sau khi gửi thành công — xem ghi chú chi tiết
  // trong reservation.ts.
  private readonly formDirective = viewChild<FormGroupDirective>('contactFormDirective');

  protected readonly form: FormGroup = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.pattern(VN_PHONE_PATTERN)]],
    email: ['', [Validators.required, Validators.email]],
    subject: ['', [Validators.required]],
    message: ['', [Validators.required, Validators.minLength(10)]],
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
        fullName: raw.fullName,
        email: raw.email,
        subject: raw.subject,
        message: raw.message,
        // Số điện thoại không bắt buộc — chỉ gửi lên khi có nhập, tránh backend validate pattern
        // trên chuỗi rỗng rồi báo lỗi sai định dạng dù người dùng không hề nhập gì.
        ...(raw.phone ? { phone: raw.phone } : {}),
      };
      await firstValueFrom(this.http.post(CONTACT_MESSAGES_API_URL, payload));
      this.successMessage.set('Gửi liên hệ thành công! Chúng tôi sẽ phản hồi qua email sớm nhất.');
      this.formDirective()?.resetForm();
    } catch (error: any) {
      const serverMessage = error?.error?.message;
      const message = Array.isArray(serverMessage) ? serverMessage.join(', ') : serverMessage;
      this.errorMessage.set(message || 'Gửi liên hệ thất bại, vui lòng thử lại.');
    } finally {
      this.submitting.set(false);
    }
  }
}

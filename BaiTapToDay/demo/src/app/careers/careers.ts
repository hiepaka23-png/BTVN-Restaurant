import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { VN_PHONE_PATTERN } from '../validators';
import { BackLink } from '../back-link/back-link';
import { AutofillSyncDirective } from '../autofill-sync-directive';

export const JOB_APPLICATIONS_API_URL = 'http://localhost:3000/job-applications';

export const OPEN_POSITIONS = [
  { title: 'Bếp trưởng', note: 'Trên 5 năm kinh nghiệm ẩm thực Âu' },
  { title: 'Phụ bếp', note: 'Ưu tiên biết chế biến món Việt/Ý' },
  { title: 'Nhân viên phục vụ', note: 'Giao tiếp tốt, ngoại hình ưa nhìn' },
  { title: 'Lễ tân', note: 'Ưu tiên biết tiếng Anh' },
  { title: 'Quản lý ca', note: 'Có kinh nghiệm quản lý nhà hàng' },
];

@Component({
  selector: 'app-careers',
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
  templateUrl: './careers.html',
  styleUrl: './careers.css',
})
export class CareersPage {
  private readonly fb = inject(FormBuilder);
  private readonly http = inject(HttpClient);

  protected readonly positions = OPEN_POSITIONS;
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly submitting = signal(false);

  protected readonly form: FormGroup = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required, Validators.pattern(VN_PHONE_PATTERN)]],
    position: ['', Validators.required],
    message: [''],
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
      await firstValueFrom(this.http.post(JOB_APPLICATIONS_API_URL, this.form.value));
      this.successMessage.set('Nộp hồ sơ thành công! Bộ phận nhân sự sẽ liên hệ với bạn sớm.');
      this.form.reset();
    } catch (error: any) {
      const serverMessage = error?.error?.message;
      const message = Array.isArray(serverMessage) ? serverMessage.join(', ') : serverMessage;
      this.errorMessage.set(message || 'Nộp hồ sơ thất bại, vui lòng thử lại.');
    } finally {
      this.submitting.set(false);
    }
  }
}

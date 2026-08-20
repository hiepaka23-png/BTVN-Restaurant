import { Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { API_ORIGIN, BACKEND_ORIGIN } from '../api-config';

export const JOB_APPLICATIONS_API_URL = `${API_ORIGIN}/job-applications`;
export const UPLOADS_API_URL = `${API_ORIGIN}/uploads`;

interface OpenPosition {
  title: string;
  icon: string;
  department: string;
  salaryRange: string;
  shift: string;
  requirements: string[];
}

// Backend job-applications hiện chỉ lưu "position" dạng chuỗi tự do (chưa có service/API riêng
// quản lý danh sách vị trí tuyển dụng) nên vẫn khai báo tĩnh ở đây như code gốc — chỉ bổ sung
// thêm các trường mô tả (bộ phận/lương/ca/yêu cầu) để khớp với ảnh tham khảo.
export const OPEN_POSITIONS: OpenPosition[] = [
  {
    title: 'Nhân viên phục vụ',
    icon: 'room_service',
    department: 'Phục vụ',
    salaryRange: '7 – 12 triệu',
    shift: 'Ca xoay',
    requirements: ['Giao tiếp tốt, thái độ thân thiện', 'Phục vụ khách hàng theo tiêu chuẩn 5 sao'],
  },
  {
    title: 'Phụ bếp',
    icon: 'soup_kitchen',
    department: 'Bếp',
    salaryRange: '6 – 10 triệu',
    shift: 'Toàn thời gian',
    requirements: ['Hỗ trợ sơ chế, chế biến món ăn', 'Giữ gìn vệ sinh khu vực bếp'],
  },
  {
    title: 'Bartender',
    icon: 'local_bar',
    department: 'Pha chế',
    salaryRange: '8 – 15 triệu',
    shift: 'Ca tối',
    requirements: ['Pha chế đồ uống theo công thức', 'Sáng tạo, nhanh nhẹn, thích giao tiếp'],
  },
  {
    title: 'Thu ngân',
    icon: 'point_of_sale',
    department: 'Thu ngân',
    salaryRange: '7 – 11 triệu',
    shift: 'Ca linh hoạt',
    requirements: ['Thao tác thu ngân chính xác', 'Trung thực, cẩn thận và có trách nhiệm'],
  },
];

const MAX_CV_SIZE_BYTES = 10 * 1024 * 1024;

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

  protected readonly selectedFile = signal<File | null>(null);
  protected readonly fileError = signal('');
  protected readonly dragOver = signal(false);

  // Cần lấy FormGroupDirective để reset đúng cách sau khi nộp hồ sơ thành công — xem ghi chú
  // chi tiết trong reservation.ts.
  private readonly formDirective = viewChild<FormGroupDirective>('careersFormDirective');
  private readonly formCard = viewChild<ElementRef<HTMLElement>>('applicationCard');

  protected readonly form: FormGroup = this.fb.group({
    fullName: ['', [Validators.required, Validators.minLength(2)]],
    phone: ['', [Validators.required, Validators.pattern(VN_PHONE_PATTERN)]],
    email: ['', [Validators.required, Validators.email]],
    position: ['', Validators.required],
  });

  protected selectPosition(position: OpenPosition): void {
    this.form.patchValue({ position: position.title });
    this.formCard()?.nativeElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  protected onFileInputChange(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.handleFile(input.files?.[0] ?? null);
    input.value = '';
  }

  protected onFileDropped(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    this.handleFile(event.dataTransfer?.files?.[0] ?? null);
  }

  protected onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  protected onDragLeave(): void {
    this.dragOver.set(false);
  }

  protected removeFile(): void {
    this.selectedFile.set(null);
    this.fileError.set('');
  }

  protected formatFileSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private handleFile(file: File | null): void {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      this.fileError.set('Chỉ chấp nhận file định dạng PDF');
      return;
    }
    if (file.size > MAX_CV_SIZE_BYTES) {
      this.fileError.set('Dung lượng file tối đa 10MB');
      return;
    }
    this.fileError.set('');
    this.selectedFile.set(file);
  }

  protected async submit(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    if (!this.selectedFile()) {
      this.fileError.set('Vui lòng tải lên CV của bạn (định dạng PDF)');
      return;
    }

    this.submitting.set(true);
    try {
      const file = this.selectedFile()!;
      const formData = new FormData();
      formData.append('file', file);
      const uploadRes = await firstValueFrom(
        this.http.post<{ url: string }>(`${UPLOADS_API_URL}/cv`, formData),
      );
      const payload = {
        ...this.form.value,
        cvUrl: `${BACKEND_ORIGIN}${uploadRes.url}`,
        cvFileName: file.name,
      };
      await firstValueFrom(this.http.post(JOB_APPLICATIONS_API_URL, payload));
      this.successMessage.set('Nộp hồ sơ thành công! Bộ phận nhân sự sẽ liên hệ với bạn sớm.');
      this.formDirective()?.resetForm();
      this.removeFile();
    } catch (error: any) {
      const serverMessage = error?.error?.message;
      const message = Array.isArray(serverMessage) ? serverMessage.join(', ') : serverMessage;
      this.errorMessage.set(message || 'Nộp hồ sơ thất bại, vui lòng thử lại.');
    } finally {
      this.submitting.set(false);
    }
  }
}

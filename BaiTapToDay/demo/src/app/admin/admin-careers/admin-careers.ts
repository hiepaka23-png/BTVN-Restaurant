import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatIconModule } from '@angular/material/icon';

import { JobApplication } from '../../models';
import { JobApplicationService } from '../../job-application-service';
import { AdminNav } from '../admin-nav/admin-nav';

// Trang quản trị xem hồ sơ ứng tuyển gửi từ /careers — chỉ đọc (GET /job-applications), không có
// thao tác xử lý trạng thái nào vì đề bài chỉ yêu cầu "admin xem được".
@Component({
  selector: 'app-admin-careers',
  imports: [CommonModule, MatIconModule, AdminNav],
  templateUrl: './admin-careers.html',
  styleUrl: './admin-careers.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCareersPage implements OnInit {
  private readonly jobApplicationService = inject(JobApplicationService);

  protected readonly applications = signal<JobApplication[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');

  ngOnInit(): void {
    this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      this.applications.set(await this.jobApplicationService.findAll());
    } catch {
      this.errorMessage.set('Không tải được danh sách hồ sơ ứng tuyển.');
    } finally {
      this.loading.set(false);
    }
  }

  protected formatDate(value: string): string {
    return new Date(value).toLocaleString('vi-VN');
  }
}

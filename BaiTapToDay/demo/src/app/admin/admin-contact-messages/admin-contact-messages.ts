import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { ContactMessage } from '../../models';
import { ContactMessageService } from '../../contact-message-service';
import { AdminNav } from '../admin-nav/admin-nav';

// Trang quản trị xem tin nhắn liên hệ gửi từ /contact — chỉ đọc (GET /contact-messages), không có
// thao tác xử lý trạng thái nào vì đề bài chỉ yêu cầu "admin xem được".
@Component({
  selector: 'app-admin-contact-messages',
  imports: [CommonModule, AdminNav],
  templateUrl: './admin-contact-messages.html',
  styleUrl: './admin-contact-messages.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminContactMessagesPage implements OnInit {
  private readonly contactMessageService = inject(ContactMessageService);

  protected readonly messages = signal<ContactMessage[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');

  ngOnInit(): void {
    this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      this.messages.set(await this.contactMessageService.findAll());
    } catch {
      this.errorMessage.set('Không tải được danh sách tin nhắn liên hệ.');
    } finally {
      this.loading.set(false);
    }
  }

  protected formatDate(value: string): string {
    return new Date(value).toLocaleString('vi-VN');
  }
}

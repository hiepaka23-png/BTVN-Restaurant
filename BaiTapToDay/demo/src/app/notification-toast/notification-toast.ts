import { Component, inject } from '@angular/core';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';

export interface NotificationToastData {
  title: string;
  message: string;
}

// Thẻ thông báo tuỳ chỉnh (chuông + tiêu đề + nội dung + nút đóng) thay cho thanh snackbar mặc
// định của Material — dùng chung cho MỌI thông báo trong app (đơn hàng, quà tặng, hồ sơ...) qua
// NotificationService.showToast() và các nơi khác gọi snackBar.openFromComponent(NotificationToast, ...).
@Component({
  selector: 'app-notification-toast',
  imports: [MatIconModule],
  templateUrl: './notification-toast.html',
  styleUrl: './notification-toast.css',
})
export class NotificationToast {
  protected readonly data = inject<NotificationToastData>(MAT_SNACK_BAR_DATA);
  private readonly snackBarRef = inject(MatSnackBarRef);

  protected close(): void {
    this.snackBarRef.dismiss();
  }
}

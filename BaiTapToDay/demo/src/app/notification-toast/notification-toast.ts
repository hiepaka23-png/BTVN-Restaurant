import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { MAT_SNACK_BAR_DATA, MatSnackBarRef } from '@angular/material/snack-bar';
import { MatIconModule } from '@angular/material/icon';

export interface NotificationToastData {
  title: string;
  message: string;
  // Có route thì cả thẻ (trừ nút đóng) bấm được, điều hướng tới đúng trang liên quan (đơn hàng,
  // đặt bàn, liên hệ, tuyển dụng...) rồi tự đóng thông báo.
  route?: string;
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
  private readonly router = inject(Router);

  protected open(): void {
    if (!this.data.route) {
      return;
    }
    this.router.navigateByUrl(this.data.route);
    this.snackBarRef.dismiss();
  }

  // Chặn nổi bọt lên (click) của thẻ cha — bấm nút đóng không được kéo theo điều hướng.
  protected close(event: Event): void {
    event.stopPropagation();
    this.snackBarRef.dismiss();
  }
}

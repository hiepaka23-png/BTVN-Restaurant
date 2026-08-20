import { inject, Injectable } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { NotificationToast } from './notification-toast/notification-toast';

// Bọc MatSnackBar để MỌI thông báo trong app (đơn hàng, quà tặng, giỏ hàng, hồ sơ...) đều hiện
// cùng 1 kiểu thẻ trắng bo góc (NotificationToast) ở góc dưới phải, thay vì thanh đen mặc định của
// Material — chỉ cần gọi .show(...) thay cho snackBar.open(...) trực tiếp.
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly snackBar = inject(MatSnackBar);

  show(message: string, title = 'Thông báo', duration = 4000): void {
    this.snackBar.openFromComponent(NotificationToast, {
      data: { title, message },
      panelClass: 'brand-toast-panel',
      duration,
    });
  }
}

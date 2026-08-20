import { Component, inject } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import type { PromoCode } from '../models';

// Popup hiện phần thưởng sau khi mở hộp quà. Trả về `true` cho afterClosed() khi người dùng bấm
// "Áp dụng ngay" để component cha lo việc copy mã vào clipboard (dialog chỉ báo ý định, không tự
// gọi clipboard API để giữ dialog thuần hiển thị).
@Component({
  selector: 'app-gift-reward-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './gift-reward-dialog.html',
  styleUrl: './gift-reward-dialog.css',
})
export class GiftRewardDialog {
  private readonly dialogRef = inject(MatDialogRef<GiftRewardDialog>);
  protected readonly data = inject<PromoCode>(MAT_DIALOG_DATA);

  protected apply(): void {
    this.dialogRef.close(true);
  }

  protected close(): void {
    this.dialogRef.close(false);
  }
}

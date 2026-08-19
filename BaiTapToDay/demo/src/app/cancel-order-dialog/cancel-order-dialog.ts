import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatRadioModule } from '@angular/material/radio';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export const CANCEL_REASON_OPTIONS = [
  'Đổi ý, không muốn đặt nữa',
  'Đặt nhầm món',
  'Muốn thay đổi thông tin giao hàng',
  'Thời gian giao hàng không phù hợp',
] as const;

const OTHER_OPTION = 'Lý do khác';

// Dialog huỷ đơn phía user: bắt chọn lý do giữa các option cố định (khác với admin phải TỰ GÕ lý
// do khi huỷ đơn của khách — user chỉ cần chọn). Chọn "Lý do khác" thì mới hiện ô nhập tự do.
// Trả về string lý do (hoặc null nếu người dùng bấm Huỷ/đóng dialog) qua afterClosed().
@Component({
  selector: 'app-cancel-order-dialog',
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatRadioModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './cancel-order-dialog.html',
  styleUrl: './cancel-order-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CancelOrderDialog {
  protected readonly dialogRef = inject(MatDialogRef<CancelOrderDialog>);

  protected readonly reasonOptions = CANCEL_REASON_OPTIONS;
  protected readonly otherOption = OTHER_OPTION;

  protected readonly selectedReason = signal<string>(CANCEL_REASON_OPTIONS[0]);
  protected readonly customReason = signal('');
  protected readonly submitted = signal(false);

  protected readonly isOtherSelected = computed(() => this.selectedReason() === OTHER_OPTION);
  protected readonly customReasonInvalid = computed(
    () => this.isOtherSelected() && this.submitted() && !this.customReason().trim(),
  );

  protected confirm(): void {
    this.submitted.set(true);
    if (this.isOtherSelected() && !this.customReason().trim()) {
      return;
    }
    const reason = this.isOtherSelected() ? this.customReason().trim() : this.selectedReason();
    this.dialogRef.close(reason);
  }

  protected cancel(): void {
    this.dialogRef.close(null);
  }
}

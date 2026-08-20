import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';

export interface DeleteAccountDialogData {
  email: string;
  devToken?: string;
}

// Bước xác thực OTP trước khi xóa tài khoản (chống kẻ gian chiếm phiên đăng nhập rồi xóa thẳng).
// Dialog chỉ thu thập mã người dùng nhập — ProfilePage mới là nơi gọi API xóa thật và xử lý lỗi
// mã sai/hết hạn, theo đúng quy ước "dialog không tự gọi service" đã dùng ở ConfirmDialog.
@Component({
  selector: 'app-delete-account-dialog',
  imports: [
    ReactiveFormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  templateUrl: './delete-account-dialog.html',
  styleUrl: './delete-account-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DeleteAccountDialog {
  protected readonly dialogRef = inject(MatDialogRef<DeleteAccountDialog>);
  protected readonly data = inject<DeleteAccountDialogData>(MAT_DIALOG_DATA);
  private readonly fb = inject(FormBuilder);

  protected readonly devTokenHint = signal(this.data.devToken ?? '');

  protected readonly form: FormGroup = this.fb.group({
    token: [
      this.data.devToken ?? '',
      [Validators.required, Validators.pattern(/^\d{6}$/)],
    ],
  });

  protected confirm(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.dialogRef.close(this.form.value.token as string);
  }

  protected cancel(): void {
    this.dialogRef.close(null);
  }
}

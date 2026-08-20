import { ChangeDetectionStrategy, Component, computed, inject, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormGroupDirective, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';

import { AuthService } from '../auth-service';
import { UserService } from '../user-service';
import { OrderService } from '../order-service';
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { AvatarCropDialog, AvatarCropDialogData } from '../avatar-crop-dialog/avatar-crop-dialog';
import { DeleteAccountDialog, DeleteAccountDialogData } from '../delete-account-dialog/delete-account-dialog';
import { AutofillSyncDirective } from '../autofill-sync-directive';
import { ToastService } from '../toast-service';
import { resolveImageUrl } from '../api-config';
import { BackLink } from '../back-link/back-link';

const DEFAULT_AVATAR = 'https://api.dicebear.com/9.x/initials/svg?seed=User';
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

// Backend không trả về ngày tạo tài khoản (toPublicUser chỉ whitelist id/username/email/name/
// role/avatarUrl), nhưng 4 byte đầu của MongoDB ObjectId vốn đã mã hoá sẵn thời điểm document
// được tạo (giây kể từ epoch) — id này đã có sẵn trong AuthUser nên tách được ngày tham gia THẬT
// mà không cần đổi API/backend.
function dateFromObjectId(id: string | undefined): Date | null {
  if (!id || id.length < 8) {
    return null;
  }
  const seconds = parseInt(id.slice(0, 8), 16);
  return Number.isNaN(seconds) ? null : new Date(seconds * 1000);
}

// Trang hồ sơ cá nhân: sửa tên/email, đổi avatar (upload -> gán avatarUrl), đổi mật khẩu, và xóa
// tài khoản (đằng sau ConfirmDialog dùng chung). Ba khối là 3 form riêng biệt vì mỗi khối gọi một
// endpoint khác nhau và có state lỗi/thành công độc lập.
@Component({
  selector: 'app-profile',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    BackLink,
    AutofillSyncDirective,
  ],
  templateUrl: './profile.html',
  styleUrl: './profile.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePage {
  protected readonly auth = inject(AuthService);
  private readonly userService = inject(UserService);
  private readonly orderService = inject(OrderService);
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly router = inject(Router);

  protected readonly defaultAvatar = DEFAULT_AVATAR;
  protected readonly resolveImageUrl = resolveImageUrl;

  protected readonly joinDate = computed(() => dateFromObjectId(this.auth.currentUser()?.id));

  // Tổng đơn hàng: tải thật từ /orders/me (đã có sẵn, dùng lại cho trang "Đơn hàng của tôi").
  protected readonly orderCount = signal<number | null>(null);

  // Món yêu thích cá nhân: cùng key localStorage với bộ lọc "Yêu thích" ở trang thực đơn
  // (my_favorite_recipes_<username>) — không phải cờ isFavorite do admin đặt.
  protected readonly favoriteCount = signal(this.countMyFavorites());

  // Email không cho đổi qua form hồ sơ (gắn với đăng nhập/định danh tài khoản) — disable control
  // thay vì chỉ readonly để loại email khỏi payload submit, tránh gửi thừa giá trị không đổi được.
  protected readonly profileForm: FormGroup = this.fb.group({
    name: [this.auth.currentUser()?.name ?? '', [Validators.required, Validators.minLength(2)]],
    email: [{ value: this.auth.currentUser()?.email ?? '', disabled: true }],
  });

  // Cần lấy FormGroupDirective để reset đúng cách sau khi đổi mật khẩu thành công — gọi thẳng
  // passwordForm.reset() chỉ xoá value/dirty/touched của các control, KHÔNG xoá cờ "submitted"
  // trên directive, nên ErrorStateMatcher mặc định của Material vẫn coi form là "đã submit" và
  // hiện lại lỗi "bắt buộc nhập" ngay khi field rỗng sau reset.
  private readonly passwordFormDirective = viewChild<FormGroupDirective>('passwordFormDirective');

  protected readonly passwordForm: FormGroup = this.fb.group({
    currentPassword: ['', [Validators.required, Validators.maxLength(20)]],
    newPassword: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(20)]],
    confirmPassword: ['', [Validators.required, Validators.minLength(6), Validators.maxLength(20)]],
  });

  protected readonly profileError = signal('');
  protected readonly profileSuccess = signal('');
  protected readonly profileSubmitting = signal(false);

  protected readonly passwordError = signal('');
  protected readonly passwordSuccess = signal('');
  protected readonly passwordSubmitting = signal(false);

  protected readonly avatarUploading = signal(false);

  protected readonly hideCurrentPassword = signal(true);
  protected readonly hideNewPassword = signal(true);
  protected readonly hideConfirmPassword = signal(true);

  protected readonly deleteError = signal('');
  protected readonly deleteSubmitting = signal(false);

  constructor() {
    this.orderService
      .getMyOrders()
      .then((orders) => this.orderCount.set(orders.length))
      .catch(() => this.orderCount.set(0));
  }

  private countMyFavorites(): number {
    const username = this.auth.currentUser()?.username ?? 'khach';
    try {
      const raw = localStorage.getItem(`my_favorite_recipes_${username}`);
      return raw ? (JSON.parse(raw) as number[]).length : 0;
    } catch {
      return 0;
    }
  }

  protected async onSaveProfile(): Promise<void> {
    this.profileError.set('');
    this.profileSuccess.set('');
    if (this.profileForm.invalid) {
      this.profileForm.markAllAsTouched();
      return;
    }

    this.profileSubmitting.set(true);
    try {
      const updated = await this.userService.updateMe(this.profileForm.value);
      this.auth.updateCurrentUser(updated);
      this.profileSuccess.set('Đã cập nhật hồ sơ thành công!');
    } catch (error: any) {
      this.profileError.set(error?.error?.message || 'Cập nhật hồ sơ thất bại, vui lòng thử lại.');
    } finally {
      this.profileSubmitting.set(false);
    }
  }

  protected async onChangePassword(): Promise<void> {
    this.passwordError.set('');
    this.passwordSuccess.set('');
    if (this.passwordForm.invalid) {
      this.passwordForm.markAllAsTouched();
      return;
    }

    const { currentPassword, newPassword, confirmPassword } = this.passwordForm.value;
    if (newPassword !== confirmPassword) {
      this.passwordError.set('Mật khẩu xác nhận không khớp!');
      return;
    }

    this.passwordSubmitting.set(true);
    try {
      await this.userService.changePassword({ currentPassword, newPassword });
      this.passwordSuccess.set('Đổi mật khẩu thành công!');
      this.passwordFormDirective()?.resetForm();
    } catch (error: any) {
      this.passwordError.set(error?.error?.message || 'Đổi mật khẩu thất bại, vui lòng kiểm tra lại mật khẩu hiện tại.');
    } finally {
      this.passwordSubmitting.set(false);
    }
  }

  // Lỗi avatar hiện ngay trên màn hình bằng snackbar (nổi lên rồi tự tắt) thay vì dòng chữ nhỏ nằm
  // dưới nút — vị trí đó dễ bị bỏ lỡ nếu người dùng đã lướt mắt sang chỗ khác của trang.
  private showAvatarError(message: string): void {
    this.toast.show(message);
  }

  protected async onAvatarSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.showAvatarError('Chỉ chấp nhận file ảnh (JPG, PNG, WEBP, GIF)');
      input.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      this.showAvatarError('Kích thước ảnh tối đa 5MB');
      input.value = '';
      return;
    }

    // Luôn cho căn chỉnh/cắt ảnh trước khi dùng làm avatar — ảnh gốc thường không vuông hay
    // không canh đúng khuôn mặt, GIF động thì bỏ qua bước này vì cắt sẽ làm mất hoạt ảnh.
    let uploadFile: File = file;
    if (file.type !== 'image/gif') {
      const dialogRef = this.dialog.open<AvatarCropDialog, AvatarCropDialogData, Blob | null>(
        AvatarCropDialog,
        {
          panelClass: 'brand-dialog-panel',
          data: { file },
          width: '460px',
        },
      );
      const croppedBlob = await firstValueFrom(dialogRef.afterClosed());
      input.value = '';
      if (!croppedBlob) {
        return; // Người dùng bấm Huỷ.
      }
      uploadFile = new File([croppedBlob], file.name.replace(/\.[^.]+$/, '.png'), {
        type: croppedBlob.type || 'image/png',
      });
    } else {
      input.value = '';
    }

    this.avatarUploading.set(true);
    try {
      const url = await this.userService.uploadAvatar(uploadFile);
      const updated = await this.userService.updateMe({ avatarUrl: url });
      this.auth.updateCurrentUser(updated);
    } catch (error: any) {
      this.showAvatarError(error?.error?.message || 'Tải ảnh đại diện lên thất bại, vui lòng thử lại.');
    } finally {
      this.avatarUploading.set(false);
    }
  }

  // Xóa tài khoản gồm 2 bước: (1) xác nhận ý định qua ConfirmDialog như cũ, (2) bắt buộc nhập mã
  // OTP gửi về email đăng ký (DeleteAccountDialog) trước khi API xóa thật sự chạy — chặn kịch bản
  // kẻ gian chiếm được phiên đăng nhập (token) rồi xóa thẳng tài khoản nạn nhân mà không cần biết
  // mật khẩu hay quyền truy cập email.
  protected async onDeleteAccount(): Promise<void> {
    this.deleteError.set('');
    const dialogRef = this.dialog.open(ConfirmDialog, {
      panelClass: 'brand-dialog-panel',
      data: {
        title: 'Xóa tài khoản',
        message: 'Bạn có chắc muốn xóa vĩnh viễn tài khoản này? Hành động này không thể hoàn tác.',
        confirmText: 'Tiếp tục',
        danger: true,
      },
    });
    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) {
      return;
    }

    this.deleteSubmitting.set(true);
    let devToken: string | undefined;
    try {
      const requested = await this.userService.requestDeleteAccount();
      devToken = requested.devToken;
    } catch (error: any) {
      this.deleteError.set(
        error?.error?.message || 'Không gửi được mã xác thực, vui lòng thử lại.',
      );
      this.deleteSubmitting.set(false);
      return;
    }
    this.deleteSubmitting.set(false);

    const otpDialogRef = this.dialog.open<DeleteAccountDialog, DeleteAccountDialogData, string | null>(
      DeleteAccountDialog,
      {
        panelClass: 'brand-dialog-panel',
        data: { email: this.auth.currentUser()?.email ?? '', devToken },
      },
    );
    const token = await firstValueFrom(otpDialogRef.afterClosed());
    if (!token) {
      return;
    }

    this.deleteSubmitting.set(true);
    try {
      await this.userService.deleteMe(token);
      this.auth.logout();
    } catch (error: any) {
      this.deleteError.set(error?.error?.message || 'Xóa tài khoản thất bại, vui lòng thử lại.');
    } finally {
      this.deleteSubmitting.set(false);
    }
  }
}

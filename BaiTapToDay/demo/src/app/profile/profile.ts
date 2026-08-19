import { ChangeDetectionStrategy, Component, inject, signal, viewChild } from '@angular/core';
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
import { ConfirmDialog } from '../confirm-dialog/confirm-dialog';
import { BackLink } from '../back-link/back-link';
import { AutofillSyncDirective } from '../autofill-sync-directive';

const DEFAULT_AVATAR = 'https://api.dicebear.com/9.x/initials/svg?seed=User';
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_IMAGE_SIZE_BYTES = 5 * 1024 * 1024;

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
  private readonly fb = inject(FormBuilder);
  private readonly dialog = inject(MatDialog);
  private readonly router = inject(Router);

  protected readonly defaultAvatar = DEFAULT_AVATAR;

  protected readonly profileForm: FormGroup = this.fb.group({
    name: [this.auth.currentUser()?.name ?? '', [Validators.required, Validators.minLength(2)]],
    email: [this.auth.currentUser()?.email ?? '', [Validators.required, Validators.email]],
  });

  // Cần lấy FormGroupDirective để reset đúng cách sau khi đổi mật khẩu thành công — gọi thẳng
  // passwordForm.reset() chỉ xoá value/dirty/touched của các control, KHÔNG xoá cờ "submitted"
  // trên directive, nên ErrorStateMatcher mặc định của Material vẫn coi form là "đã submit" và
  // hiện lại lỗi "bắt buộc nhập" ngay khi field rỗng sau reset.
  private readonly passwordFormDirective = viewChild<FormGroupDirective>('passwordFormDirective');

  protected readonly passwordForm: FormGroup = this.fb.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  });

  protected readonly profileError = signal('');
  protected readonly profileSuccess = signal('');
  protected readonly profileSubmitting = signal(false);

  protected readonly passwordError = signal('');
  protected readonly passwordSuccess = signal('');
  protected readonly passwordSubmitting = signal(false);

  protected readonly avatarError = signal('');
  protected readonly avatarUploading = signal(false);

  protected readonly deleteError = signal('');
  protected readonly deleteSubmitting = signal(false);

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

  protected async onAvatarSelected(event: Event): Promise<void> {
    this.avatarError.set('');
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) {
      return;
    }

    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      this.avatarError.set('Chỉ chấp nhận file ảnh (JPG, PNG, WEBP, GIF)');
      input.value = '';
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      this.avatarError.set('Kích thước ảnh tối đa 5MB');
      input.value = '';
      return;
    }

    this.avatarUploading.set(true);
    try {
      const url = await this.userService.uploadAvatar(file);
      const updated = await this.userService.updateMe({ avatarUrl: url });
      this.auth.updateCurrentUser(updated);
    } catch (error: any) {
      this.avatarError.set(error?.error?.message || 'Tải ảnh đại diện lên thất bại, vui lòng thử lại.');
    } finally {
      this.avatarUploading.set(false);
      input.value = '';
    }
  }

  protected async onDeleteAccount(): Promise<void> {
    this.deleteError.set('');
    const dialogRef = this.dialog.open(ConfirmDialog, {
      panelClass: 'brand-dialog-panel',
      data: {
        title: 'Xóa tài khoản',
        message: 'Bạn có chắc muốn xóa vĩnh viễn tài khoản này? Hành động này không thể hoàn tác.',
        confirmText: 'Xóa tài khoản',
        danger: true,
      },
    });
    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) {
      return;
    }

    this.deleteSubmitting.set(true);
    try {
      await this.userService.deleteMe();
      this.auth.logout();
    } catch (error: any) {
      this.deleteError.set(error?.error?.message || 'Xóa tài khoản thất bại, vui lòng thử lại.');
    } finally {
      this.deleteSubmitting.set(false);
    }
  }
}

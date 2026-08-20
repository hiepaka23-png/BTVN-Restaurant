import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatDialog } from '@angular/material/dialog';

import { AuthService, AuthUser } from '../../auth-service';
import { UserService } from '../../user-service';
import { ConfirmDialog } from '../../confirm-dialog/confirm-dialog';
import { AdminNav } from '../admin-nav/admin-nav';

// Trang quản lý thành viên: tìm kiếm mọi user (GET /users?keyword=), liệt kê admin hiện tại
// (GET /users?role=admin), cấp quyền admin và thu hồi quyền admin (đằng sau ConfirmDialog).
// Backend chặn admin tự thu hồi quyền của chính mình (403) — bắt lỗi này và hiển thị thông báo
// rõ ràng thay vì để lỗi rơi ra console.
@Component({
  selector: 'app-admin-members',
  imports: [
    CommonModule,
    FormsModule,
    MatIconModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    AdminNav,
  ],
  templateUrl: './admin-members.html',
  styleUrl: './admin-members.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMembersPage implements OnInit {
  private readonly userService = inject(UserService);
  private readonly dialog = inject(MatDialog);
  protected readonly auth = inject(AuthService);

  protected readonly searchKeyword = signal('');
  protected readonly searchResults = signal<AuthUser[]>([]);
  protected readonly searchLoading = signal(false);
  protected readonly searchError = signal('');

  protected readonly admins = signal<AuthUser[]>([]);
  protected readonly adminsLoading = signal(true);
  protected readonly adminsError = signal('');

  protected readonly actioningId = signal<string | null>(null);
  protected readonly actionMessage = signal('');
  protected readonly actionError = signal('');

  // Chỉ tài khoản chủ hệ thống mới thấy nút ban/unban — admin thường (kể cả vừa được cấp quyền)
  // không có, đúng yêu cầu "chỉ mình tôi ban được".
  protected readonly isSuperAdmin = () => this.auth.currentUser()?.isSuperAdmin === true;

  ngOnInit(): void {
    this.loadAdmins();
    this.runSearch();
  }

  protected async loadAdmins(): Promise<void> {
    this.adminsLoading.set(true);
    this.adminsError.set('');
    try {
      this.admins.set(await this.userService.searchUsers(undefined, 'admin'));
    } catch {
      this.adminsError.set('Không tải được danh sách quản trị viên.');
    } finally {
      this.adminsLoading.set(false);
    }
  }

  protected async runSearch(): Promise<void> {
    this.searchLoading.set(true);
    this.searchError.set('');
    try {
      this.searchResults.set(await this.userService.searchUsers(this.searchKeyword().trim() || undefined));
    } catch {
      this.searchError.set('Không tìm kiếm được thành viên.');
    } finally {
      this.searchLoading.set(false);
    }
  }

  protected async grantAdmin(user: AuthUser): Promise<void> {
    this.actionMessage.set('');
    this.actionError.set('');
    this.actioningId.set(user.id);
    try {
      await this.userService.updateRole(user.id, 'admin');
      this.actionMessage.set(`Đã cấp quyền admin cho ${user.username}.`);
      await Promise.all([this.loadAdmins(), this.runSearch()]);
    } catch (error: any) {
      this.actionError.set(error?.error?.message || 'Cấp quyền admin thất bại.');
    } finally {
      this.actioningId.set(null);
    }
  }

  protected async revokeAdmin(user: AuthUser): Promise<void> {
    this.actionMessage.set('');
    this.actionError.set('');

    const dialogRef = this.dialog.open(ConfirmDialog, {
      panelClass: 'brand-dialog-panel',
      data: {
        title: 'Thu hồi quyền admin',
        message: `Bạn có chắc muốn thu hồi quyền admin của "${user.username}" không?`,
        confirmText: 'Thu hồi',
        danger: true,
      },
    });
    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) {
      return;
    }

    this.actioningId.set(user.id);
    try {
      await this.userService.updateRole(user.id, 'user');
      this.actionMessage.set(`Đã thu hồi quyền admin của ${user.username}.`);
      await Promise.all([this.loadAdmins(), this.runSearch()]);
    } catch (error: any) {
      if (error?.status === 403) {
        this.actionError.set('Bạn không thể tự thu hồi quyền admin của chính mình.');
      } else {
        this.actionError.set(error?.error?.message || 'Thu hồi quyền admin thất bại.');
      }
    } finally {
      this.actioningId.set(null);
    }
  }

  protected async banUser(user: AuthUser): Promise<void> {
    this.actionMessage.set('');
    this.actionError.set('');

    const dialogRef = this.dialog.open(ConfirmDialog, {
      panelClass: 'brand-dialog-panel',
      data: {
        title: 'Ban tài khoản',
        message: `Bạn có chắc muốn ban tài khoản "${user.username}"? Tài khoản này sẽ bị đăng xuất ngay và không thể đăng nhập lại.`,
        confirmText: 'Ban',
        danger: true,
      },
    });
    const confirmed = await firstValueFrom(dialogRef.afterClosed());
    if (!confirmed) {
      return;
    }

    this.actioningId.set(user.id);
    try {
      await this.userService.banUser(user.id);
      this.actionMessage.set(`Đã ban tài khoản ${user.username}.`);
      await Promise.all([this.loadAdmins(), this.runSearch()]);
    } catch (error: any) {
      this.actionError.set(error?.error?.message || 'Ban tài khoản thất bại.');
    } finally {
      this.actioningId.set(null);
    }
  }

  protected async unbanUser(user: AuthUser): Promise<void> {
    this.actionMessage.set('');
    this.actionError.set('');
    this.actioningId.set(user.id);
    try {
      await this.userService.unbanUser(user.id);
      this.actionMessage.set(`Đã bỏ ban tài khoản ${user.username}.`);
      await Promise.all([this.loadAdmins(), this.runSearch()]);
    } catch (error: any) {
      this.actionError.set(error?.error?.message || 'Bỏ ban tài khoản thất bại.');
    } finally {
      this.actioningId.set(null);
    }
  }
}

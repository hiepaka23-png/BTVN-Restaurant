import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { AuthUser } from './auth-service';
import { API_ORIGIN, BACKEND_ORIGIN } from './api-config';

export const USERS_API_URL = `${API_ORIGIN}/users`;
export const UPLOADS_API_URL = `${API_ORIGIN}/uploads`;
export { BACKEND_ORIGIN };

export interface UpdateProfilePayload {
  name?: string;
  email?: string;
  avatarUrl?: string;
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
}

// Bao phủ API /users (hồ sơ cá nhân + quản trị thành viên) và /uploads/avatar. Các thao tác
// admin-only (getUsers, updateRole) được backend tự chặn theo role — service chỉ gọi API.
@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly http = inject(HttpClient);

  getMe(): Promise<AuthUser> {
    return firstValueFrom(this.http.get<AuthUser>(`${USERS_API_URL}/me`));
  }

  updateMe(patch: UpdateProfilePayload): Promise<AuthUser> {
    return firstValueFrom(this.http.patch<AuthUser>(`${USERS_API_URL}/me`, patch));
  }

  changePassword(payload: ChangePasswordPayload): Promise<{ message: string }> {
    return firstValueFrom(
      this.http.patch<{ message: string }>(`${USERS_API_URL}/me/password`, payload),
    );
  }

  // Xóa tài khoản bắt buộc có mã xác thực gửi qua email trước, để phòng kẻ gian chiếm được phiên
  // đăng nhập rồi xóa thẳng tài khoản của người dùng.
  requestDeleteAccount(): Promise<{ message: string; devToken?: string }> {
    return firstValueFrom(
      this.http.post<{ message: string; devToken?: string }>(
        `${USERS_API_URL}/me/delete/request`,
        {},
      ),
    );
  }

  deleteMe(token: string): Promise<{ message: string }> {
    return firstValueFrom(
      this.http.delete<{ message: string }>(`${USERS_API_URL}/me`, { body: { token } }),
    );
  }

  async uploadAvatar(file: File): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    const res = await firstValueFrom(
      this.http.post<{ url: string }>(`${UPLOADS_API_URL}/avatar`, formData),
    );
    return `${BACKEND_ORIGIN}${res.url}`;
  }

  // --- Admin only ---

  searchUsers(keyword?: string, role?: string): Promise<AuthUser[]> {
    const params: string[] = [];
    if (keyword) {
      params.push(`keyword=${encodeURIComponent(keyword)}`);
    }
    if (role) {
      params.push(`role=${encodeURIComponent(role)}`);
    }
    const query = params.length ? `?${params.join('&')}` : '';
    return firstValueFrom(this.http.get<AuthUser[]>(`${USERS_API_URL}${query}`));
  }

  updateRole(id: string, role: 'user' | 'admin'): Promise<AuthUser> {
    return firstValueFrom(this.http.patch<AuthUser>(`${USERS_API_URL}/${id}/role`, { role }));
  }

  // Chỉ super admin (chủ hệ thống) mới gọi được — backend tự chặn (403) nếu không phải, kể cả với
  // tài khoản admin thường.
  banUser(id: string): Promise<AuthUser> {
    return firstValueFrom(this.http.patch<AuthUser>(`${USERS_API_URL}/${id}/ban`, {}));
  }

  unbanUser(id: string): Promise<AuthUser> {
    return firstValueFrom(this.http.patch<AuthUser>(`${USERS_API_URL}/${id}/unban`, {}));
  }
}

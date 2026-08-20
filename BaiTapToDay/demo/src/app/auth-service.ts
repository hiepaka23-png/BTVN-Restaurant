import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { API_ORIGIN } from './api-config';

export const AUTH_API_URL = `${API_ORIGIN}/auth`;

const ACCESS_TOKEN_KEY = 'access_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const USER_KEY = 'auth_user';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  avatarUrl?: string | null;
}

interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: AuthUser;
}

// Phân tích JSON an toàn — nếu server chết/rớt kết nối giữa chừng (vd DB mất kết nối khiến request
// bị cắt ngang), body trả về có thể rỗng/không hợp lệ và res.json() ném lỗi parse thô, khó hiểu với
// người dùng. Trường hợp đó coi như không có message cụ thể, để caller tự hiện thông báo dự phòng.
export async function parseJsonSafely(
  res: Response,
): Promise<{ message?: string; [key: string]: unknown }> {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

function readStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

// Quản lý phiên đăng nhập: access_token (JWT sống ngắn) + refresh_token (dùng để lấy access_token
// mới khi hết hạn, xoay vòng mỗi lần gọi) + thông tin user đầy đủ trả về từ backend (không còn giải
// mã JWT để lấy username/role như trước — backend giờ trả thẳng user object).
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly router = inject(Router);

  readonly currentUser = signal<AuthUser | null>(readStoredUser());
  readonly isAdmin = computed(() => this.currentUser()?.role === 'admin');

  getAccessToken(): string | null {
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  }

  isLoggedIn(): boolean {
    return !!this.getAccessToken() && this.currentUser() !== null;
  }

  private persistSession(data: AuthResponse): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, data.access_token);
    localStorage.setItem(REFRESH_TOKEN_KEY, data.refresh_token);
    localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    this.currentUser.set(data.user);
  }

  // Gọi bởi interceptor sau khi POST /auth/refresh thành công — refresh token xoay vòng mỗi lần.
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  }

  // Chủ động lấy access token MỚI ngay cả khi token hiện tại chưa hết hạn — cần thiết vì role được
  // nhúng thẳng vào JWT lúc đăng nhập: nếu admin đổi quyền của một tài khoản đang có phiên hợp lệ,
  // access token cũ vẫn còn "sống" (chưa 401) nhưng mang role cũ, khiến các API @Roles('admin') bị
  // chặn 403 dù tài khoản đã thật sự là admin trong DB (interceptor chỉ tự refresh khi gặp 401,
  // không phải 403). Dùng fetch() thay vì HttpClient để tránh vòng lặp qua chính interceptor.
  async refreshTokens(): Promise<boolean> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      return false;
    }
    try {
      const res = await fetch(`${AUTH_API_URL}/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });
      const data = await parseJsonSafely(res);
      if (!res.ok || !data['access_token']) {
        return false;
      }
      this.setTokens(data['access_token'] as string, data['refresh_token'] as string);
      return true;
    } catch {
      return false;
    }
  }

  // Cập nhật thông tin user cục bộ (sau khi PATCH /users/me) mà không cần đăng nhập lại.
  updateCurrentUser(patch: Partial<AuthUser>): void {
    const merged = { ...this.currentUser(), ...patch } as AuthUser;
    localStorage.setItem(USER_KEY, JSON.stringify(merged));
    this.currentUser.set(merged);
  }

  // identifier: chấp nhận email hoặc username — backend tự thử cả hai cách tra cứu.
  async login(identifier: string, password: string): Promise<void> {
    const res = await fetch(`${AUTH_API_URL}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier, password }),
    });

    const data = await parseJsonSafely(res);
    if (!res.ok || !data['access_token']) {
      throw new Error(
        (data.message as string) ||
          'Tài khoản hoặc mật khẩu không chính xác! (hoặc server/database đang gián đoạn, thử lại sau ít phút)',
      );
    }

    this.persistSession(data as unknown as AuthResponse);
  }

  async register(username: string, email: string, name: string, password: string): Promise<void> {
    const res = await fetch(`${AUTH_API_URL}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, name, password }),
    });

    const data = await parseJsonSafely(res);
    if (!res.ok || !data['access_token']) {
      const message = Array.isArray(data.message) ? data.message.join(', ') : data.message;
      throw new Error(
        (message as string) ||
          'Đăng ký thất bại! (hoặc server/database đang gián đoạn, thử lại sau ít phút)',
      );
    }

    this.persistSession(data as unknown as AuthResponse);
  }

  private clearSession(): void {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this.currentUser.set(null);
  }

  // Đăng xuất chủ động của người dùng: báo cho server thu hồi refresh token (best-effort,
  // không chặn UI nếu request lỗi) rồi xóa phiên cục bộ và chuyển về /login.
  logout(): void {
    const token = this.getAccessToken();
    this.clearSession();
    this.router.navigate(['/login']);
    if (token) {
      fetch(`${AUTH_API_URL}/logout`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }).catch(() => {});
    }
  }

  // Dùng bởi interceptor khi refresh token cũng đã hết hạn/không hợp lệ — không gọi /auth/logout
  // vì phiên coi như đã chết ở phía server, chỉ cần dọn cục bộ và điều hướng kèm lý do.
  forceLogout(reason: 'expired' | 'invalid'): void {
    this.clearSession();
    this.router.navigate(['/login'], { queryParams: { reason } });
  }
}

import { HttpBackend, HttpClient, HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';
import { AUTH_API_URL, AuthService } from './auth-service';

// Gắn Bearer token vào mọi request. Khi gặp 401 (access token hết hạn) — trừ chính các endpoint
// /auth/* — thử POST /auth/refresh một lần bằng refresh token đã lưu rồi phát lại request gốc với
// access token mới; chỉ đăng xuất + chuyển về /login nếu refresh cũng thất bại.
// Dùng HttpBackend (bỏ qua toàn bộ interceptor chain) cho lệnh gọi refresh để tránh vòng lặp/circular DI.
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);
  const backend = inject(HttpBackend);

  const token = authService.getAccessToken();
  const authorizedReq = token
    ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } })
    : req;

  const isAuthEndpoint = req.url.startsWith(AUTH_API_URL);

  return next(authorizedReq).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401 || isAuthEndpoint) {
        return throwError(() => error);
      }

      const refreshToken = authService.getRefreshToken();
      if (!refreshToken) {
        authService.forceLogout('invalid');
        return throwError(() => error);
      }

      const rawHttp = new HttpClient(backend);
      return rawHttp
        .post<{ access_token: string; refresh_token: string }>(`${AUTH_API_URL}/refresh`, {
          refreshToken,
        })
        .pipe(
          switchMap((tokens) => {
            authService.setTokens(tokens.access_token, tokens.refresh_token);
            const retriedReq = req.clone({
              setHeaders: { Authorization: `Bearer ${tokens.access_token}` },
            });
            return next(retriedReq);
          }),
          catchError((refreshError: unknown) => {
            const message =
              refreshError instanceof HttpErrorResponse ? refreshError.error?.message : undefined;
            authService.forceLogout(message === 'TOKEN_EXPIRED' ? 'expired' : 'invalid');
            return throwError(() => refreshError);
          }),
        );
    }),
  );
};

import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideNativeDateAdapter, MAT_DATE_LOCALE } from '@angular/material/core'; // ➕ thêm dòng này
import { MAT_SNACK_BAR_DEFAULT_OPTIONS } from '@angular/material/snack-bar';
import { routes } from './app.routes';
import { authInterceptor } from './auth-interceptor';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([authInterceptor])),
    provideNativeDateAdapter(),                     // ➕ thêm dòng này
    { provide: MAT_DATE_LOCALE, useValue: 'vi-VN' },
    // Áp dụng cho MỌI thông báo dạng snackbar trong app (đơn hàng mới, mở quà, cập nhật hồ sơ...)
    // — góc dưới phải, kiểu tin nhắn thông báo, thay vì mặc định giữa-dưới đè lên nội dung trang.
    {
      provide: MAT_SNACK_BAR_DEFAULT_OPTIONS,
      useValue: { horizontalPosition: 'end', verticalPosition: 'bottom', duration: 4000 },
    },
  ]
};

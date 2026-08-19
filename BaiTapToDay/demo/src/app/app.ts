import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { DomSanitizer } from '@angular/platform-browser';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatIconModule, MatIconRegistry } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatBadgeModule } from '@angular/material/badge';
import { AuthService } from './auth-service';
import { CartService } from './cart-service';
import { NotificationService } from './notification-service';

const AUTH_ROUTES = ['/login'];

// Huy hiệu hình huân chương: vành khuyên kép bao quanh một ngôi sao — gợi hình ảnh giải
// thưởng ẩm thực cao cấp, dùng làm logo thương hiệu "Nhà Hàng Michelin".
const STAR_MEDALLION_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" fill="none">
  <circle cx="50" cy="50" r="46" stroke="currentColor" stroke-width="3"/>
  <circle cx="50" cy="50" r="39" stroke="currentColor" stroke-width="1"/>
  <polygon fill="currentColor" points="50,8 60,36.25 90,37.02 66.17,55.25 74.69,83.98 50,67 25.31,83.98 33.83,55.25 10.05,37.02 40.01,36.25"/>
</svg>
`;

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    MatToolbarModule,
    MatIconModule,
    MatButtonModule,
    MatSidenavModule,
    MatBadgeModule,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly brandName = signal('Nhà Hàng Michelin');
  protected readonly brandTagline = signal('5 Sao');

  private readonly iconRegistry = inject(MatIconRegistry);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly router = inject(Router);
  protected readonly auth = inject(AuthService);
  protected readonly cart = inject(CartService);
  // Chỉ cần inject để kích hoạt effect() nội bộ mở kết nối SSE ngay khi app khởi động và người
  // dùng đã đăng nhập — bản thân App không gọi trực tiếp phương thức nào của service này.
  private readonly notifications = inject(NotificationService);

  private readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  // Chỉ hiện toolbar (username + đăng xuất) khi không ở các trang xác thực và đã đăng nhập.
  protected readonly showToolbar = computed(() => {
    const url = this.currentUrl();
    const isAuthRoute = AUTH_ROUTES.some((route) => url.startsWith(route));
    return !isAuthRoute && this.auth.currentUser() !== null;
  });

  constructor() {
    this.iconRegistry.addSvgIconLiteral(
      'star-medallion',
      this.sanitizer.bypassSecurityTrustHtml(STAR_MEDALLION_SVG),
    );
  }
}

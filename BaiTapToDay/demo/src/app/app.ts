import { Component, computed, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { filter, map } from 'rxjs';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog } from '@angular/material/dialog';
import { AuthService } from './auth-service';
import { CartService } from './cart-service';
import { NotificationService } from './notification-service';
import { UserService } from './user-service';
import { PromoService } from './promo-service';
import { resolveImageUrl } from './api-config';
import { AnnouncementBar } from './announcement-bar/announcement-bar';
import { LuckyGift } from './lucky-gift/lucky-gift';

const AUTH_ROUTES = ['/login'];

interface NavItem {
  label: string;
  icon: string;
  link?: string;
  queryParams?: Record<string, string>;
  action?: 'gift';
  isActive: (url: string) => boolean;
}

// Trang xem món hiện là trang chủ kiêm thực đơn (chưa có route riêng cho từng mục) — "Ưu đãi" mở
// thẳng minigame Hộp Quà May Mắn, "Cài đặt" trỏ vào Hồ sơ cá nhân (chưa có trang cài đặt riêng) —
// mọi mục đều trỏ tới chức năng thật đang có, không tạo trang giả không có nội dung.
const NAV_ITEMS: NavItem[] = [
  {
    label: 'Trang chủ',
    icon: 'home',
    link: '/recipes',
    isActive: (url) => url.startsWith('/recipes') && !url.includes('favorite='),
  },
  {
    label: 'Yêu thích',
    icon: 'favorite',
    link: '/recipes',
    queryParams: { favorite: 'true' },
    isActive: (url) => url.startsWith('/recipes') && url.includes('favorite='),
  },
  {
    label: 'Đặt bàn',
    icon: 'event_seat',
    link: '/reservation',
    isActive: (url) => url.startsWith('/reservation'),
  },
  {
    label: 'Ưu đãi',
    icon: 'card_giftcard',
    action: 'gift',
    isActive: () => false,
  },
  {
    label: 'Đơn hàng',
    icon: 'receipt_long',
    link: '/orders',
    isActive: (url) => url.startsWith('/orders'),
  },
  {
    label: 'Tuyển dụng',
    icon: 'work_outline',
    link: '/careers',
    isActive: (url) => url.startsWith('/careers'),
  },
  {
    label: 'Liên hệ',
    icon: 'call',
    link: '/contact',
    isActive: (url) => url.startsWith('/contact'),
  },
  {
    label: 'Cài đặt',
    icon: 'settings',
    link: '/profile',
    isActive: (url) => url.startsWith('/profile'),
  },
];

@Component({
  selector: 'app-root',
  imports: [
    RouterOutlet,
    RouterLink,
    MatIconModule,
    MatButtonModule,
    MatBadgeModule,
    AnnouncementBar,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  protected readonly brandName = signal('Nhà Hàng Michelin');
  protected readonly brandTagline = signal('5 Sao');
  protected readonly resolveImageUrl = resolveImageUrl;
  protected readonly navItems = NAV_ITEMS;

  private readonly router = inject(Router);
  private readonly dialog = inject(MatDialog);
  protected readonly auth = inject(AuthService);
  protected readonly cart = inject(CartService);
  private readonly userService = inject(UserService);
  private readonly promoService = inject(PromoService);

  // Ẩn nút "Quà mỗi ngày" trên header ngay khi đã mở hộp quà hôm nay — đỡ mời gọi bấm vào một
  // chức năng chắc chắn báo "đã nhận quà hôm nay". Tự hiện lại khi qua ngày mới vì getToday() chỉ
  // tính đơn tạo trong ngày hôm nay (xem PromoCodesService.getTodayCode ở backend).
  protected readonly giftClaimedToday = signal(false);
  // Chỉ cần inject để kích hoạt effect() nội bộ mở kết nối SSE ngay khi app khởi động và người
  // dùng đã đăng nhập — bản thân App không gọi trực tiếp phương thức nào của service này.
  private readonly notifications = inject(NotificationService);

  protected readonly currentUrl = toSignal(
    this.router.events.pipe(
      filter((event) => event instanceof NavigationEnd),
      map((event) => event.urlAfterRedirects),
    ),
    { initialValue: this.router.url },
  );

  // Chỉ hiện toàn bộ khung app (sidebar + header + thanh chạy chữ) khi không ở trang xác thực và
  // đã đăng nhập — trang /login tự lo bố cục riêng của nó.
  protected readonly showAppShell = computed(() => {
    const url = this.currentUrl();
    const isAuthRoute = AUTH_ROUTES.some((route) => url.startsWith(route));
    return !isAuthRoute && this.auth.currentUser() !== null;
  });

  // Sidebar luôn ở dạng dải hẹp cố định (logo + nút 3 gạch) không chiếm thêm chỗ của nội dung —
  // bấm nút 3 gạch chỉ mở/đóng 1 lớp overlay nổi lên trên, không đẩy/co nội dung chính nên không
  // gây giật hình khi bật tắt. true = đang mở overlay, false = chỉ còn dải hẹp.
  protected readonly sidebarExpanded = signal(false);

  constructor() {
    // Role được nhúng thẳng vào JWT lúc đăng nhập và không tự cập nhật — nếu admin cấp/thu hồi
    // quyền cho một tài khoản đang đăng nhập sẵn, access token cũ vẫn "sống" (chưa hết hạn) nhưng
    // mang role cũ, nên phải chủ động lấy access token MỚI (refreshTokens — không đợi 401 như
    // interceptor) rồi mới đồng bộ lại thông tin user, mỗi khi mở app (F5/mở tab mới), để không
    // bắt buộc phải đăng xuất/đăng nhập lại mới dùng được quyền mới.
    if (this.auth.currentUser() !== null) {
      this.auth
        .refreshTokens()
        .then(() => this.userService.getMe())
        .then((freshUser) => this.auth.updateCurrentUser(freshUser))
        .catch(() => {});

      this.refreshGiftStatus();
    }
  }

  private refreshGiftStatus(): void {
    this.promoService
      .getToday()
      .then((promo) => this.giftClaimedToday.set(promo !== null))
      .catch(() => {});
  }

  protected toggleSidebar(): void {
    this.sidebarExpanded.update((expanded) => !expanded);
  }

  protected closeSidebar(): void {
    this.sidebarExpanded.set(false);
  }

  // Sau khi bấm 1 mục điều hướng, tự đóng overlay lại để thấy ngay nội dung trang vừa chuyển tới.
  protected onNavLinkClick(): void {
    this.sidebarExpanded.set(false);
  }

  protected openGiftBox(): void {
    this.sidebarExpanded.set(false);
    const dialogRef = this.dialog.open(LuckyGift, { panelClass: 'brand-dialog-panel', autoFocus: false });
    // Đóng khung (dù đã mở quà hay chỉ xem rồi thoát) đều nạp lại trạng thái — ẩn nút "Quà mỗi
    // ngày" trên header ngay nếu vừa nhận quà trong lượt này.
    dialogRef.afterClosed().subscribe(() => this.refreshGiftStatus());
  }
}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

// Breadcrumb "Quay lại" dùng chung cho các trang không có nội dung điều hướng riêng ở đầu trang
// (careers, contact, cart, my-orders...) — nằm trong luồng trang (không fixed nổi trên nội dung
// nữa), góc trái, cùng kiểu với breadcrumb ở trang Hồ sơ cá nhân/Chi tiết món ăn để nhất quán.
@Component({
  selector: 'app-back-link',
  imports: [RouterLink, MatIconModule],
  templateUrl: './back-link.html',
  styleUrl: './back-link.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackLink {
  readonly to = input('/recipes');
  readonly label = input('Quay lại trang chủ');
}

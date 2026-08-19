import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { MatIconModule } from '@angular/material/icon';

// Thanh điều hướng dùng chung cho toàn bộ khu vực quản trị (/admin/*) — tông màu than chì/xám tối
// (khác hẳn tông đỏ rượu vang + vàng đồng của giao diện khách hàng) để phân biệt rõ ràng đây là
// khu vực quản trị, theo đúng yêu cầu đề bài (không tái sử dụng giao diện trang khách).
@Component({
  selector: 'app-admin-nav',
  imports: [RouterLink, RouterLinkActive, MatIconModule],
  templateUrl: './admin-nav.html',
  styleUrl: './admin-nav.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminNav {}

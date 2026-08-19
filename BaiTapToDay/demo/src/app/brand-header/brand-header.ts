import { Component } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';

// Khối logo dùng chung cho các trang xác thực (đăng nhập/đăng ký/quên mật khẩu) —
// icon 'star-medallion' được đăng ký một lần ở App root (app.ts), tái sử dụng ở đây.
@Component({
  selector: 'app-brand-header',
  standalone: true,
  imports: [MatIconModule],
  templateUrl: './brand-header.html',
  styleUrl: './brand-header.css',
})
export class BrandHeader {}

import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

// Nút "Quay lại" dùng chung cho các trang không có nội dung điều hướng riêng ở đầu trang
// (careers, contact, reservation, cart, my-orders, profile...). Cùng kiểu dáng với .back-link
// đã dùng ở recipe-detail/add-recipe để nhất quán trong toàn app.
@Component({
  selector: 'app-back-link',
  imports: [RouterLink, MatButtonModule, MatIconModule],
  templateUrl: './back-link.html',
  styleUrl: './back-link.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BackLink {
  readonly to = input('/recipes');
  readonly label = input('Quay lại trang chủ');
}

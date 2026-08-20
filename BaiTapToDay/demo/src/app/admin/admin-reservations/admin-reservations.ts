import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

import { Reservation } from '../../models';
import { ReservationService } from '../../reservation-service';
import { AdminNav } from '../admin-nav/admin-nav';

// Trang quản trị xem yêu cầu đặt bàn gửi từ /reservation — chỉ đọc (GET /reservations), không có
// thao tác xử lý trạng thái nào vì đề bài chỉ yêu cầu "admin xem được".
@Component({
  selector: 'app-admin-reservations',
  imports: [CommonModule, AdminNav],
  templateUrl: './admin-reservations.html',
  styleUrl: './admin-reservations.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminReservationsPage implements OnInit {
  private readonly reservationService = inject(ReservationService);

  protected readonly reservations = signal<Reservation[]>([]);
  protected readonly loading = signal(true);
  protected readonly errorMessage = signal('');

  ngOnInit(): void {
    this.load();
  }

  protected async load(): Promise<void> {
    this.loading.set(true);
    this.errorMessage.set('');
    try {
      this.reservations.set(await this.reservationService.findAll());
    } catch {
      this.errorMessage.set('Không tải được danh sách đặt bàn.');
    } finally {
      this.loading.set(false);
    }
  }

  protected formatCreatedAt(value: string): string {
    return new Date(value).toLocaleString('vi-VN');
  }

  // reservation.date lưu dạng chuỗi "yyyy-MM-dd" (xem reservation.ts phía form đặt bàn) — parse thủ
  // công thay vì new Date(value) trực tiếp để tránh lệch múi giờ (new Date('2026-08-25') hiểu theo
  // UTC nên có thể hiện lùi 1 ngày ở múi giờ Việt Nam).
  protected formatBookingDate(value: string): string {
    const [year, month, day] = value.split('-');
    return year && month && day ? `${day}/${month}/${year}` : value;
  }
}

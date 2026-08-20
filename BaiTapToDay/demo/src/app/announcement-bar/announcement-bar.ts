import { Component } from '@angular/core';

// Thanh thông báo chạy chữ ngay dưới header — chào mừng khách và gợi ý mở "Hộp Quà May Mắn".
// Hiệu ứng marquee dựng bằng thuần CSS (không dùng JS/interval) để mượt, nhẹ — cố tình LUÔN chạy
// bất kể máy có tắt hiệu ứng hệ thống hay không (không theo prefers-reduced-motion) vì đây là nội
// dung quảng cáo cố định, tắt animation sẽ mất hẳn tác dụng chứ không đơn thuần là "bớt hoạt hình".
// Kỹ thuật lặp vô hạn: nhân đôi dải nội dung rồi trượt đúng 50% chiều rộng — khi vòng lặp quay lại
// điểm 0, dải thứ 2 đã nằm khít vào vị trí dải thứ 1 nên liền mạch.
@Component({
  selector: 'app-announcement-bar',
  imports: [],
  templateUrl: './announcement-bar.html',
  styleUrl: './announcement-bar.css',
})
export class AnnouncementBar {
  protected readonly messages = [
    'Chào mừng quý khách đến với Nhà Hàng Michelin 5 Sao',
    'Trải nghiệm hương vị độc quyền từ các đầu bếp hàng đầu',
    'Nhập mã ANHMANHDZVCL để giảm chi phí cho hóa đơn đầu tiên',
    'Đặt món hôm nay — trải nghiệm ẩm thực đẳng cấp 5 sao',
    'Hotline đặt bàn nhanh chóng: 1900 2211 - Phục vụ tận tâm 24/7'
  ];
}

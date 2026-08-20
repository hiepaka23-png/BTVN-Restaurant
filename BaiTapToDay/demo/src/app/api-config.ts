// Địa chỉ gốc của backend NestJS.
// - Lúc dev (`ng serve` ở cổng 4200): frontend và backend là 2 tiến trình khác nhau (backend luôn
//   ở cổng 3000) — suy ra hostname từ trang đang mở (thay vì hardcode "localhost") để mở được từ
//   điện thoại/máy khác cùng mạng LAN qua IP của máy chạy server (vd http://192.168.1.10:4200);
//   "localhost" trên thiết bị đó trỏ vào chính thiết bị đó chứ không phải máy chủ, gây lỗi
//   "Failed to fetch".
// - Lúc deploy thật (production build do chính NestJS phục vụ luôn — xem ServeStaticModule ở
//   app.module.ts): frontend và backend LÀ MỘT, chạy chung 1 domain/cổng do nền tảng host cấp
//   (không phải 3000) — dùng thẳng window.location.origin, không được cộng thêm ":3000" vào.
export const BACKEND_ORIGIN =
  window.location.port === '4200'
    ? `${window.location.protocol}//${window.location.hostname}:3000`
    : window.location.origin;

// Mọi route API thật của backend (không phải file tĩnh) đều nằm dưới /api (app.setGlobalPrefix
// ở main.ts) — tách khỏi các route trang Angular để tránh đụng đường dẫn khi 2 bên chạy chung 1
// domain lúc deploy (vd /recipes/5 vừa là trang chi tiết món ăn vừa từng trùng API GET /recipes/:id).
export const API_ORIGIN = `${BACKEND_ORIGIN}/api`;

// Ảnh upload (avatar, ảnh món ăn) được LƯU trong DB dưới dạng URL tuyệt đối tại thời điểm upload
// (vd http://localhost:3000/uploads/xxx.jpg) — nếu ảnh đó được admin tải lên khi đang mở app qua
// "localhost", URL lưu lại sẽ mãi mãi trỏ vào "localhost", vỡ ảnh với BẤT KỲ ai xem từ thiết bị
// khác (kể cả sau khi BACKEND_ORIGIN ở trên đã tự nhận đúng hostname), vì URL đã "đóng băng" origin
// cũ ngay trong dữ liệu. Hàm này chuẩn hoá lại mọi URL dạng ".../uploads/..." (dù cũ hay mới, dù
// origin đã lưu là gì) về đúng BACKEND_ORIGIN hiện tại của người đang xem — không cần migrate DB.
// URL ảnh ngoài thật (link Unsplash/CDN của dữ liệu mẫu) không khớp "/uploads/" nên giữ nguyên.
export function resolveImageUrl(url: string | null | undefined): string {
  if (!url) {
    return '';
  }
  const uploadsMatch = url.match(/\/uploads\/.+$/);
  return uploadsMatch ? `${BACKEND_ORIGIN}${uploadsMatch[0]}` : url;
}

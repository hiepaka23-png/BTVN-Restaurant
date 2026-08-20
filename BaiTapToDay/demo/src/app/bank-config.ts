// 🎉 Troll mode: QR "chuyển khoản" ở trang đơn hàng giờ dẫn thẳng tới video kinh điển... thay vì
// QR chuyển khoản ngân hàng thật. Đây là quyết định có chủ đích (đã hỏi lại và xác nhận) — dùng
// api.qrserver.com (miễn phí, không cần API key) vì dịch vụ đó encode được URL bất kỳ, khác với
// vietqr.io trước đây (chỉ sinh được đúng QR chuẩn ngân hàng, không nhét link tuỳ ý vào được).
//
// Muốn quay lại QR chuyển khoản thật: điền BANK_BIN/BANK_ACCOUNT_NO/BANK_ACCOUNT_NAME thật của
// bạn rồi đổi buildBankQrUrl() sang gọi img.vietqr.io như bản trước.
//
// Dùng link rút gọn (tinyurl) thay vì dán thẳng link youtube.com — nhiều trình quét QR trên điện
// thoại hiện preview URL trước khi mở, dán thẳng link youtube sẽ lộ ngay là troll trước khi bấm
// vào. Link rút gọn dưới đây trỏ đúng tới video gốc, đã kiểm tra redirect thật (không phải giả).
const RICKROLL_URL = 'https://tinyurl.com/2fcpre6';

export function buildBankQrUrl(_amount: number, _note: string): string {
  const params = new URLSearchParams({
    size: '260x260',
    data: RICKROLL_URL,
  });
  return `https://api.qrserver.com/v1/create-qr-code/?${params.toString()}`;
}

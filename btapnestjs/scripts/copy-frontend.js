// Copy bản build Angular (dist/demo/browser) vào public/ để NestJS phục vụ chung 1 domain/cổng
// duy nhất (xem ServeStaticModule ở app.module.ts) — dùng cho deploy production, không dùng lúc
// dev (`ng serve` + `nest start --watch` chạy riêng 2 cổng 4200/3000 như bình thường).
// Chỉ copy/ghi đè — KHÔNG xoá public/ trước khi copy, để không mất ảnh người dùng đã tải lên
// (public/uploads/...) giữa các lần deploy.
const { cpSync, existsSync } = require('node:fs');
const { join } = require('node:path');

const FRONTEND_BUILD_DIR = join(__dirname, '..', '..', 'BaiTapToDay', 'demo', 'dist', 'demo', 'browser');
const PUBLIC_DIR = join(__dirname, '..', 'public');

if (!existsSync(FRONTEND_BUILD_DIR)) {
  console.error(`Không tìm thấy bản build frontend tại: ${FRONTEND_BUILD_DIR}`);
  console.error('Chạy "npm run build" trong BaiTapToDay/demo trước.');
  process.exit(1);
}

cpSync(FRONTEND_BUILD_DIR, PUBLIC_DIR, { recursive: true });
console.log(`Đã copy ${FRONTEND_BUILD_DIR} -> ${PUBLIC_DIR}`);

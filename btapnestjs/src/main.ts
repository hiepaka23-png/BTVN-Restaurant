import { setServers } from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// Máy dev có VPN ảo (Radmin VPN) chèn DNS server IPv6 không phản hồi, khiến lookup SRV
// của mongodb+srv:// bị ECONNREFUSED. Ép Node dùng thẳng Google DNS để tránh việc này.
setServers(['8.8.8.8', '8.8.4.4']);

// Cho phép cả localhost lẫn địa chỉ IP mạng LAN riêng (192.168.x.x, 10.x.x.x, 172.16-31.x.x) ở
// BẤT KỲ cổng nào — để mở app từ điện thoại/máy khác trong cùng mạng qua IP của máy chạy server
// (vd: http://192.168.1.10:4200) không bị chặn CORS. Không hardcode 1 IP cụ thể vì IP LAN có thể
// đổi (DHCP) mỗi lần khởi động lại router/máy. Không hardcode cổng 4200 vì `ng serve` tự đổi sang
// cổng khác khi 4200 đang bị chiếm — chỉ giới hạn origin ở localhost/dải IP riêng tư (không public)
// nên cho phép mọi cổng vẫn an toàn, không mở CORS cho cả internet.
const LAN_ORIGIN_PATTERN =
  /^http:\/\/((localhost)|(127\.0\.0\.1)|(192\.168\.\d{1,3}\.\d{1,3})|(10\.\d{1,3}\.\d{1,3}\.\d{1,3})|(172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3})):\d+$/;

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // Mọi route API nằm dưới /api/* — tách khỏi các route trang Angular (vd /recipes/5 vừa là trang
  // chi tiết món ăn phía frontend vừa từng trùng với API GET /recipes/:id) khi frontend build và
  // API cùng phục vụ chung 1 domain lúc deploy (xem ServeStaticModule ở app.module.ts).
  app.setGlobalPrefix('api');
  app.enableCors({
    origin: (origin, callback) => {
      if (!origin || LAN_ORIGIN_PATTERN.test(origin)) {
        callback(null, true);
      } else {
        callback(new Error('Không cho phép bởi CORS'), false);
      }
    },
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();

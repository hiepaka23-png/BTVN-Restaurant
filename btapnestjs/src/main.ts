import { setServers } from 'node:dns';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

// Máy dev có VPN ảo (Radmin VPN) chèn DNS server IPv6 không phản hồi, khiến lookup SRV
// của mongodb+srv:// bị ECONNREFUSED. Ép Node dùng thẳng Google DNS để tránh việc này.
setServers(['8.8.8.8', '8.8.4.4']);

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: ['http://localhost:4200'],
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

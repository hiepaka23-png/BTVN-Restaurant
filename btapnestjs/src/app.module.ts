import {
  MiddlewareConsumer,
  Module,
  NestModule,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CatModule } from './cat/cat.module';
import { UserServiceModule } from './user-service/user-service.module';
import { RecipesModule } from './recipes/recipes.module';
import { TasksModule } from './tasks/tasks.module';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';

// 1. Thêm 2 import này để phục vụ file HTML
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { ReservationsModule } from './reservations/reservations.module';
import { JobApplicationsModule } from './job-applications/job-applications.module';
import { ContactMessagesModule } from './contact-messages/contact-messages.module';
import { UploadsModule } from './uploads/uploads.module';
import { NotificationsModule } from './notifications/notifications.module';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';

@Module({
  imports: [
    // 2. Cấu hình đọc file index.html từ thư mục public
    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'public'),
    }),
    TasksModule,
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.getOrThrow<string>('MONGODB_URI'),
      }),
    }),
    CatModule,
    UserServiceModule,
    RecipesModule,
    AuthModule,
    UsersModule,
    OrdersModule,
    ReservationsModule,
    JobApplicationsModule,
    ContactMessagesModule,
    UploadsModule,
    NotificationsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_PIPE, useValue: new ValidationPipe({ whitelist: true }) },
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}

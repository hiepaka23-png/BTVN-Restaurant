import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { User, UserSchema } from './user.schema';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { MailModule } from '../mail/mail.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { SuperAdminGuard } from '../auth/guards/super-admin.guard';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    MailModule,
    NotificationsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, SuperAdminGuard],
  exports: [UsersService],
})
export class UsersModule {}

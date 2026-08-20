import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ContactMessagesService } from './contact-messages.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/types/auth-user.interface';
import { NotificationsService } from '../notifications/notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('contact-messages')
export class ContactMessagesController {
  constructor(
    private readonly contactMessagesService: ContactMessagesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateContactMessageDto,
  ) {
    const created = await this.contactMessagesService.create(req.user.username, dto);
    this.notificationsService.emitContactMessageCreated({
      id: String((created as { _id?: unknown })._id),
      fullName: created.fullName,
      subject: created.subject,
    });
    return created;
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get()
  findAll() {
    return this.contactMessagesService.findAll();
  }
}

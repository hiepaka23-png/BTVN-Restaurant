import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/types/auth-user.interface';
import { NotificationsService } from '../notifications/notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('reservations')
export class ReservationsController {
  constructor(
    private readonly reservationsService: ReservationsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post()
  async create(@Req() req: AuthenticatedRequest, @Body() dto: CreateReservationDto) {
    const created = await this.reservationsService.create(req.user.username, dto);
    this.notificationsService.emitReservationCreated({
      id: String((created as { _id?: unknown })._id),
      customerName: created.customerName,
      date: created.date,
      time: created.time,
    });
    return created;
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get()
  findAll() {
    return this.reservationsService.findAll();
  }
}

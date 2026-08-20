import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { JobApplicationsService } from './job-applications.service';
import { CreateJobApplicationDto } from './dto/create-job-application.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import type { AuthenticatedRequest } from '../auth/types/auth-user.interface';
import { NotificationsService } from '../notifications/notifications.service';

@UseGuards(JwtAuthGuard)
@Controller('job-applications')
export class JobApplicationsController {
  constructor(
    private readonly jobApplicationsService: JobApplicationsService,
    private readonly notificationsService: NotificationsService,
  ) {}

  @Post()
  async create(
    @Req() req: AuthenticatedRequest,
    @Body() dto: CreateJobApplicationDto,
  ) {
    const created = await this.jobApplicationsService.create(req.user.username, dto);
    this.notificationsService.emitJobApplicationCreated({
      id: String((created as { _id?: unknown })._id),
      fullName: created.fullName,
      position: created.position,
    });
    return created;
  }

  @UseGuards(RolesGuard)
  @Roles('admin')
  @Get()
  findAll() {
    return this.jobApplicationsService.findAll();
  }
}

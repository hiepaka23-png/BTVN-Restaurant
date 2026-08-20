import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateJobApplicationDto } from './dto/create-job-application.dto';
import {
  JobApplication,
  JobApplicationDocument,
} from './schemas/job-application.schema';

@Injectable()
export class JobApplicationsService {
  constructor(
    @InjectModel(JobApplication.name)
    private readonly jobApplicationModel: Model<JobApplicationDocument>,
  ) {}

  async create(
    username: string,
    dto: CreateJobApplicationDto,
  ): Promise<JobApplication> {
    const created = await this.jobApplicationModel.create({
      username,
      fullName: dto.fullName.trim(),
      email: dto.email.trim(),
      phone: dto.phone.trim(),
      position: dto.position.trim(),
      message: dto.message?.trim() ?? '',
      cvUrl: dto.cvUrl.trim(),
      cvFileName: dto.cvFileName.trim(),
    });
    return created.toObject();
  }

  findAll(): Promise<JobApplication[]> {
    return this.jobApplicationModel.find().sort({ createdAt: -1 }).lean();
  }
}

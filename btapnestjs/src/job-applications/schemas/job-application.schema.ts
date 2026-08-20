import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

@Schema({ timestamps: true })
export class JobApplication {
  @Prop({ required: true })
  username: string;

  @Prop({ required: true })
  fullName: string;

  @Prop({ required: true })
  email: string;

  @Prop({ required: true })
  phone: string;

  @Prop({ required: true })
  position: string;

  @Prop({ default: '' })
  message: string;

  @Prop({ required: true })
  cvUrl: string;

  @Prop({ required: true })
  cvFileName: string;
}

export type JobApplicationDocument = HydratedDocument<JobApplication>;
export const JobApplicationSchema =
  SchemaFactory.createForClass(JobApplication);

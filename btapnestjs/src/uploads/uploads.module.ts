import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { NsfwService } from './nsfw.service';

@Module({
  controllers: [UploadsController],
  providers: [NsfwService],
})
export class UploadsModule {}

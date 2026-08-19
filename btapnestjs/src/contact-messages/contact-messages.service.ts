import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import {
  ContactMessage,
  ContactMessageDocument,
} from './schemas/contact-message.schema';

@Injectable()
export class ContactMessagesService {
  constructor(
    @InjectModel(ContactMessage.name)
    private readonly contactMessageModel: Model<ContactMessageDocument>,
  ) {}

  async create(
    username: string,
    dto: CreateContactMessageDto,
  ): Promise<ContactMessage> {
    const created = await this.contactMessageModel.create({
      username,
      fullName: dto.fullName.trim(),
      email: dto.email.trim(),
      message: dto.message.trim(),
    });
    return created.toObject();
  }

  findAll(): Promise<ContactMessage[]> {
    return this.contactMessageModel.find().sort({ createdAt: -1 }).lean();
  }
}

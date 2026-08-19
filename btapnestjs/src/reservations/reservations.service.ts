import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CreateReservationDto } from './dto/create-reservation.dto';
import { Reservation, ReservationDocument } from './schemas/reservation.schema';

@Injectable()
export class ReservationsService {
  constructor(
    @InjectModel(Reservation.name)
    private readonly reservationModel: Model<ReservationDocument>,
  ) {}

  async create(
    username: string,
    dto: CreateReservationDto,
  ): Promise<Reservation> {
    const created = await this.reservationModel.create({
      username,
      customerName: dto.customerName.trim(),
      phone: dto.phone.trim(),
      date: dto.date,
      time: dto.time,
      guestCount: dto.guestCount,
      note: dto.note?.trim() ?? '',
    });
    return created.toObject();
  }

  findAll(): Promise<Reservation[]> {
    return this.reservationModel.find().sort({ createdAt: -1 }).lean();
  }
}

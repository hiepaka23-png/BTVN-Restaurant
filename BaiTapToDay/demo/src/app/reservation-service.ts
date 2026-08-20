import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { Reservation } from './models';
import { API_ORIGIN } from './api-config';

export const RESERVATIONS_API_URL = `${API_ORIGIN}/reservations`;

// GET /reservations — chỉ admin gọi được (backend tự chặn bằng @Roles('admin')). Việc đặt bàn
// (POST) vẫn nằm trong reservation.ts, không dùng service này.
@Injectable({ providedIn: 'root' })
export class ReservationService {
  private readonly http = inject(HttpClient);

  findAll(): Promise<Reservation[]> {
    return firstValueFrom(this.http.get<Reservation[]>(RESERVATIONS_API_URL));
  }
}

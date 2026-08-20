import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { PromoCode } from './models';
import { API_ORIGIN } from './api-config';

export const PROMO_CODES_API_URL = `${API_ORIGIN}/promo-codes`;

// Mã ưu đãi từ minigame Hộp Quà May Mắn — sinh và khoá "1 lượt/ngày" ở server (xem
// PromoCodesService), không còn random/lưu localStorage thuần phía trình duyệt như bản trước.
@Injectable({ providedIn: 'root' })
export class PromoService {
  private readonly http = inject(HttpClient);

  claimDaily(): Promise<PromoCode> {
    return firstValueFrom(this.http.post<PromoCode>(`${PROMO_CODES_API_URL}/claim`, {}));
  }

  getToday(): Promise<PromoCode | null> {
    return firstValueFrom(this.http.get<PromoCode | null>(`${PROMO_CODES_API_URL}/today`));
  }
}

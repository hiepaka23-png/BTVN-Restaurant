import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ContactMessage } from './models';
import { API_ORIGIN } from './api-config';

export const CONTACT_MESSAGES_API_URL = `${API_ORIGIN}/contact-messages`;

// GET /contact-messages — chỉ admin gọi được (backend tự chặn bằng @Roles('admin')). Việc gửi liên
// hệ (POST) vẫn nằm trong contact.ts, không dùng service này.
@Injectable({ providedIn: 'root' })
export class ContactMessageService {
  private readonly http = inject(HttpClient);

  findAll(): Promise<ContactMessage[]> {
    return firstValueFrom(this.http.get<ContactMessage[]>(CONTACT_MESSAGES_API_URL));
  }
}

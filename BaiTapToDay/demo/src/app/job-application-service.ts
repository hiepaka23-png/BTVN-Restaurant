import { inject, Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { JobApplication } from './models';
import { API_ORIGIN } from './api-config';

export const JOB_APPLICATIONS_API_URL = `${API_ORIGIN}/job-applications`;

// GET /job-applications — chỉ admin gọi được (backend tự chặn bằng @Roles('admin')). Việc nộp hồ
// sơ (POST) vẫn nằm trong careers.ts, không dùng service này.
@Injectable({ providedIn: 'root' })
export class JobApplicationService {
  private readonly http = inject(HttpClient);

  findAll(): Promise<JobApplication[]> {
    return firstValueFrom(this.http.get<JobApplication[]>(JOB_APPLICATIONS_API_URL));
  }
}

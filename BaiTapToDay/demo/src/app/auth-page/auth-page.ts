import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import {
  AbstractControl,
  FormBuilder,
  FormGroup,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';

import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';

import { AUTH_API_URL, AuthService } from '../auth-service';
import { BrandHeader } from '../brand-header/brand-header';
import { AutofillSyncDirective } from '../autofill-sync-directive';

type AuthMode = 'login' | 'register' | 'forgot-request' | 'forgot-verify' | 'forgot-reset';

const REDIRECT_REASON_MESSAGES: Record<string, string> = {
  expired: 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.',
  invalid: 'Phiên đăng nhập không hợp lệ. Vui lòng đăng nhập lại.',
  banned: 'Tài khoản của bạn đã bị ban, vui lòng liên hệ tổng đài 1900 2211 để được hỗ trợ.',
};

// So khớp mật khẩu / xác nhận mật khẩu — gắn thẳng vào control confirm (không phải validator cấp
// FormGroup) vì mat-form-field chỉ hiện <mat-error> khi chính control đó tự báo invalid.
function makeMatchValidator(otherControlName: string) {
  return (control: AbstractControl): ValidationErrors | null => {
    const other = control.parent?.get(otherControlName)?.value;
    if (!control.value) {
      return null; // Để Validators.required lo trường hợp rỗng
    }
    return control.value === other ? null : { passwordMismatch: true };
  };
}

// Trang xác thực gộp chung đăng nhập / đăng ký / quên mật khẩu vào MỘT route duy nhất (/login),
// chuyển đổi qua lại bằng chế độ hiển thị nội bộ (mode signal) thay vì điều hướng route riêng —
// theo đúng yêu cầu đề bài. Quên mật khẩu dùng đúng luồng 3 bước của US-03: (1) nhập email ->
// POST /auth/forgot-password/request (backend chưa gắn dịch vụ email thật nên trả thẳng devToken
// để demo), (2) nhập mã -> POST /auth/forgot-password/verify để xác thực mã TRƯỚC khi cho đặt mật
// khẩu mới (không lộ việc mật khẩu mới hợp lệ hay không nếu mã sai), (3) nhập mật khẩu mới ->
// POST /auth/forgot-password/reset. Email + mã được giữ trong signal để mang qua các bước, không
// bắt người dùng nhập lại.
@Component({
  selector: 'app-auth-page',
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    BrandHeader,
    AutofillSyncDirective,
  ],
  templateUrl: './auth-page.html',
  styleUrl: './auth-page.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthPage implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly authService = inject(AuthService);

  protected readonly mode = signal<AuthMode>('login');
  protected readonly errorMessage = signal('');
  protected readonly successMessage = signal('');
  protected readonly devTokenHint = signal('');
  protected readonly submitting = signal(false);

  // Mang email/mã theo từng bước quên mật khẩu — không bắt người dùng gõ lại ở màn sau.
  private readonly resetEmail = signal('');
  private readonly resetToken = signal('');

  protected readonly hidePassword = signal(true);
  protected readonly hideConfirmPassword = signal(true);
  protected readonly hideNewPassword = signal(true);
  protected readonly hideConfirmNewPassword = signal(true);

  protected readonly loginForm: FormGroup = this.fb.group({
    identifier: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  protected readonly registerForm: FormGroup = this.fb.group({
    username: ['', [Validators.required, Validators.minLength(4), Validators.pattern('^[a-zA-Z0-9_]+$')]],
    name: ['', [Validators.required, Validators.minLength(2)]],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required, makeMatchValidator('password')]],
  });

  protected readonly forgotRequestForm: FormGroup = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
  });

  protected readonly forgotVerifyForm: FormGroup = this.fb.group({
    token: ['', [Validators.required]],
  });

  protected readonly forgotResetForm: FormGroup = this.fb.group({
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required, makeMatchValidator('newPassword')]],
  });

  ngOnInit(): void {
    const reason = this.route.snapshot.queryParamMap.get('reason');
    if (reason && REDIRECT_REASON_MESSAGES[reason]) {
      this.errorMessage.set(REDIRECT_REASON_MESSAGES[reason]);
    }
  }

  protected switchMode(mode: AuthMode): void {
    this.mode.set(mode);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.devTokenHint.set('');
    if (mode === 'forgot-request') {
      // Quay lại từ đầu luồng quên mật khẩu -> bỏ mã/email đã xác thực trước đó.
      this.resetEmail.set('');
      this.resetToken.set('');
      this.forgotVerifyForm.reset();
      this.forgotResetForm.reset();
    }
  }

  protected recheckRegisterConfirm(): void {
    this.registerForm.get('confirmPassword')?.updateValueAndValidity();
  }

  protected recheckResetConfirm(): void {
    this.forgotResetForm.get('confirmPassword')?.updateValueAndValidity();
  }

  protected async onLogin(): Promise<void> {
    this.errorMessage.set('');
    if (this.loginForm.invalid) {
      this.loginForm.markAllAsTouched();
      return;
    }

    const { identifier, password } = this.loginForm.value;
    this.submitting.set(true);
    try {
      await this.authService.login(identifier, password);
      await this.router.navigate(['/recipes']);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Không kết nối được tới Server backend (Port 3000)!',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  protected async onRegister(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }

    const { username, name, email, password } = this.registerForm.value;
    this.submitting.set(true);
    try {
      await this.authService.register(username, email, name, password);
      await this.router.navigate(['/recipes']);
    } catch (error) {
      this.errorMessage.set(
        error instanceof Error ? error.message : 'Không kết nối được tới Server backend (Port 3000)!',
      );
    } finally {
      this.submitting.set(false);
    }
  }

  protected async onForgotRequest(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    this.devTokenHint.set('');
    if (this.forgotRequestForm.invalid) {
      this.forgotRequestForm.markAllAsTouched();
      return;
    }

    const { email } = this.forgotRequestForm.value;
    this.submitting.set(true);
    try {
      const res = await fetch(`${AUTH_API_URL}/forgot-password/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        this.errorMessage.set(data.message || 'Không gửi được yêu cầu, vui lòng thử lại.');
        return;
      }

      this.resetEmail.set(email);
      this.successMessage.set(data.message || 'Đã gửi yêu cầu khôi phục mật khẩu.');
      if (data.devToken) {
        this.devTokenHint.set(data.devToken);
        this.forgotVerifyForm.patchValue({ token: data.devToken });
      }
      this.mode.set('forgot-verify');
    } catch {
      this.errorMessage.set('Không kết nối được tới Server backend (Port 3000)!');
    } finally {
      this.submitting.set(false);
    }
  }

  // Bước 2/3: xác thực mã khôi phục TRƯỚC khi cho người dùng đặt mật khẩu mới — đúng luồng
  // "gửi yêu cầu → xác thực → đặt lại mật khẩu mới" của US-03, thay vì để reset tự xác thực ngầm.
  protected async onForgotVerify(): Promise<void> {
    this.errorMessage.set('');
    if (this.forgotVerifyForm.invalid) {
      this.forgotVerifyForm.markAllAsTouched();
      return;
    }

    const { token } = this.forgotVerifyForm.value;
    this.submitting.set(true);
    try {
      const res = await fetch(`${AUTH_API_URL}/forgot-password/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.resetEmail(), token }),
      });
      const data = await res.json();
      if (!res.ok || !data.valid) {
        this.errorMessage.set(data.message || 'Mã xác nhận không hợp lệ hoặc đã hết hạn.');
        return;
      }

      this.resetToken.set(token);
      this.successMessage.set('');
      this.mode.set('forgot-reset');
    } catch {
      this.errorMessage.set('Không kết nối được tới Server backend (Port 3000)!');
    } finally {
      this.submitting.set(false);
    }
  }

  // Bước 3/3: mã đã được xác thực ở bước trước, giờ chỉ còn nhập mật khẩu mới.
  protected async onForgotReset(): Promise<void> {
    this.errorMessage.set('');
    this.successMessage.set('');
    if (this.forgotResetForm.invalid) {
      this.forgotResetForm.markAllAsTouched();
      return;
    }

    const { newPassword } = this.forgotResetForm.value;
    this.submitting.set(true);
    try {
      const res = await fetch(`${AUTH_API_URL}/forgot-password/reset`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: this.resetEmail(), token: this.resetToken(), newPassword }),
      });
      const data = await res.json();
      if (!res.ok) {
        this.errorMessage.set(data.message || 'Mã xác nhận không hợp lệ hoặc đã hết hạn.');
        return;
      }

      this.successMessage.set('Đặt lại mật khẩu thành công! Vui lòng đăng nhập lại.');
      this.forgotRequestForm.reset();
      this.forgotVerifyForm.reset();
      this.forgotResetForm.reset();
      this.resetEmail.set('');
      this.resetToken.set('');
      setTimeout(() => this.switchMode('login'), 1500);
    } catch {
      this.errorMessage.set('Không kết nối được tới Server backend (Port 3000)!');
    } finally {
      this.submitting.set(false);
    }
  }
}

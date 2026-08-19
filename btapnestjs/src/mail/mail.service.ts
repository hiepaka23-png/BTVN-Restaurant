import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport, Transporter } from 'nodemailer';

// Gửi email thật qua Gmail SMTP khi có cấu hình GMAIL_USER/GMAIL_APP_PASSWORD trong .env.
// Nếu chưa cấu hình (mặc định lúc mới clone project), service coi như "chưa sẵn sàng" — nơi gọi
// (AuthService) sẽ tự rơi về chế độ demo (hiện mã trực tiếp trên UI) thay vì báo lỗi.
@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter | null;
  private readonly fromAddress: string | undefined;

  constructor(private readonly configService: ConfigService) {
    const user = this.configService.get<string>('GMAIL_USER');
    const appPassword = this.configService.get<string>('GMAIL_APP_PASSWORD');

    if (user && appPassword) {
      this.transporter = createTransport({
        service: 'gmail',
        auth: { user, pass: appPassword },
      });
      this.fromAddress = user;
    } else {
      this.transporter = null;
    }
  }

  isConfigured(): boolean {
    return this.transporter !== null;
  }

  async sendPasswordResetCode(toEmail: string, code: string): Promise<boolean> {
    if (!this.transporter) return false;

    try {
      await this.transporter.sendMail({
        from: `"Nhà Hàng Michelin" <${this.fromAddress}>`,
        to: toEmail,
        subject: 'Mã đặt lại mật khẩu',
        text: `Mã đặt lại mật khẩu của bạn là: ${code}\nMã có hiệu lực trong 15 phút. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.`,
        html: `
          <p>Mã đặt lại mật khẩu của bạn là:</p>
          <p style="font-size:28px;font-weight:700;letter-spacing:4px;">${code}</p>
          <p>Mã có hiệu lực trong 15 phút. Nếu bạn không yêu cầu đặt lại mật khẩu, hãy bỏ qua email này.</p>
        `,
      });
      return true;
    } catch (error) {
      this.logger.error(
        `Gửi email đặt lại mật khẩu tới ${toEmail} thất bại`,
        error,
      );
      return false;
    }
  }
}

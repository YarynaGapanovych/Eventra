import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';
import type { PasswordResetMailer } from './password-reset-mailer';

const DEFAULT_FROM = 'Eventra <onboarding@resend.dev>';

@Injectable()
export class ResendPasswordResetMailer implements PasswordResetMailer {
  private readonly logger = new Logger(ResendPasswordResetMailer.name);
  private readonly resend: Resend;
  private readonly from: string;

  constructor(config: ConfigService) {
    const apiKey = config.get<string>('RESEND_API_KEY')?.trim();
    if (!apiKey) {
      throw new Error('RESEND_API_KEY is required for ResendPasswordResetMailer');
    }
    this.resend = new Resend(apiKey);
    this.from = config.get<string>('RESEND_FROM')?.trim() || DEFAULT_FROM;
  }

  async sendResetLink(email: string, resetUrl: string): Promise<void> {
    const href = escapeHtml(resetUrl);
    const { error } = await this.resend.emails.send({
      from: this.from,
      to: email,
      subject: 'Reset your Eventra password',
      html: `<p>Reset your password by clicking the link below:</p><p><a href="${href}">Reset password</a></p><p>This link expires in 1 hour. If you did not request this, you can ignore this email.</p>`,
      text: `Reset your Eventra password:\n${resetUrl}\n\nThis link expires in 1 hour. If you did not request this, you can ignore this email.`,
    });

    if (error) {
      this.logger.error(`Failed to send reset email to ${email}: ${error.message}`);
      throw new ServiceUnavailableException('Could not send reset email');
    }
  }
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

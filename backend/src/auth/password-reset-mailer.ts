import { Injectable, Logger } from '@nestjs/common';

export const PASSWORD_RESET_MAILER = 'PASSWORD_RESET_MAILER';

export interface PasswordResetMailer {
  sendResetLink(email: string, resetUrl: string): Promise<void>;
}

@Injectable()
export class ConsolePasswordResetMailer implements PasswordResetMailer {
  private readonly logger = new Logger(ConsolePasswordResetMailer.name);

  async sendResetLink(email: string, resetUrl: string): Promise<void> {
    this.logger.log(`Password reset link for ${email}: ${resetUrl}`);
  }
}

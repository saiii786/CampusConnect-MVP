/**
 * Outgoing email (FR-003 verification codes, FR-006 password reset).
 *
 * Feature code depends only on the abstract `MailService`; the concrete driver is chosen by
 * `MAIL_DRIVER` in mail.module.ts. Today the only driver is `console` (dev/test). A real
 * provider (PRD Q3 — must have a free tier) is added as another class implementing `send`.
 */
import { Logger } from '@nestjs/common';

export interface MailMessage {
  to: string;
  subject: string;
  /** Plain-text body. HTML templates can come later; plain text always works. */
  text: string;
}

export abstract class MailService {
  abstract send(message: MailMessage): Promise<void>;
}

/**
 * Prints emails to the server log instead of sending them, and keeps the most recent ones in
 * memory so integration tests can read verification codes. Refused in production by env.ts.
 */
export class ConsoleMailService extends MailService {
  private readonly logger = new Logger('Mail');
  private static readonly OUTBOX_LIMIT = 50;
  /** Most recent messages, newest last. For development and tests only. */
  readonly outbox: MailMessage[] = [];

  async send(message: MailMessage): Promise<void> {
    this.outbox.push(message);
    if (this.outbox.length > ConsoleMailService.OUTBOX_LIMIT) this.outbox.shift();
    this.logger.log(`To: ${message.to} | Subject: ${message.subject}\n${message.text}`);
  }

  /** Latest message sent to `to` (tests). */
  lastTo(to: string): MailMessage | undefined {
    for (let i = this.outbox.length - 1; i >= 0; i--) {
      if (this.outbox[i]!.to === to) return this.outbox[i];
    }
    return undefined;
  }
}

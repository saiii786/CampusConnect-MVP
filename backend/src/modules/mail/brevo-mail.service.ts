/**
 * Brevo (free plan: 300 emails/day) transactional email driver — PRD Q3, ADR-029.
 * API: POST https://api.brevo.com/v3/smtp/email with header `api-key`.
 *
 * - The sender address must be verified in Brevo (Senders & IP → Senders). No own domain needed.
 * - Never logs the API key or the message body (bodies contain one-time codes).
 * - Throws on failure; callers (AuthService.sendCodeSafely, student verification) decide what the
 *   user sees. A 10 s timeout keeps a slow provider from hanging a request.
 */
import { Logger } from '@nestjs/common';
import { MailService, type MailMessage } from './mail.service.js';

export const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';
const TIMEOUT_MS = 10_000;

export interface BrevoConfig {
  apiKey: string;
  fromEmail: string;
  fromName: string;
}

export class BrevoMailService extends MailService {
  private readonly logger = new Logger('Mail');

  constructor(
    private readonly config: BrevoConfig,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    super();
  }

  async send(message: MailMessage): Promise<void> {
    const res = await this.fetchImpl(BREVO_SEND_URL, {
      method: 'POST',
      headers: { 'api-key': this.config.apiKey, 'content-type': 'application/json', accept: 'application/json' },
      body: JSON.stringify({
        sender: { email: this.config.fromEmail, name: this.config.fromName },
        to: [{ email: message.to }],
        subject: message.subject,
        textContent: message.text,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) {
      // Brevo errors look like { code, message } — safe to log (no secrets, no body content).
      let detail = '';
      try {
        const body = (await res.json()) as { code?: string; message?: string };
        detail = [body.code, body.message].filter(Boolean).join(': ');
      } catch {
        // not JSON
      }
      this.logger.error(`Brevo send failed: HTTP ${res.status}${detail ? ` (${detail})` : ''}`);
      throw new Error(`Email provider error (HTTP ${res.status})`);
    }
  }
}

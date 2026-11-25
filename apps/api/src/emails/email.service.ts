import { Injectable, Logger } from '@nestjs/common';
import { getEnv } from '../config/env';
import { HttpService } from '../common/http.service';
import type { Rendered } from './templates';

export interface SendResult {
  sent: boolean;
  skipped?: boolean;
}

/** Sends email through Resend. Never throws: a failed email must never break an order. */
@Injectable()
export class EmailService {
  private readonly log = new Logger('Email');

  constructor(private readonly http: HttpService) {}

  async send(to: string, message: Rendered): Promise<SendResult> {
    let env;
    try {
      env = getEnv();
    } catch {
      return { sent: false, skipped: true };
    }
    if (!env.RESEND_API_KEY || !env.EMAIL_FROM) {
      this.log.warn(`Email "${message.subject}" not sent: RESEND_API_KEY / EMAIL_FROM are not set`);
      return { sent: false, skipped: true };
    }
    try {
      const res = await this.http.fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject: message.subject, html: message.html, text: message.text }),
      });
      if (!res.ok) {
        this.log.error(`Resend refused "${message.subject}" (HTTP ${res.status})`);
        return { sent: false };
      }
      return { sent: true };
    } catch (e) {
      this.log.error(`Could not send "${message.subject}": ${(e as Error).message}`);
      return { sent: false };
    }
  }
}

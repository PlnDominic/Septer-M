import { Injectable } from '@nestjs/common';

/** Outbound HTTP, wrapped so tests can replace it. Every call has a timeout so a slow provider cannot hang an order. */
@Injectable()
export class HttpService {
  fetch(url: string, init: RequestInit = {}, timeoutMs = 10_000): Promise<Response> {
    return fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
  }
}

/* Test helper: a stand-in for HttpService that records requests and returns scripted responses. */

export interface Call {
  url: string;
  method: string;
  headers: Record<string, string>;
  /** Parsed JSON body, or the form fields for application/x-www-form-urlencoded. */
  body: Record<string, unknown>;
  raw: string;
}

type Reply = { status?: number; body?: unknown };
export type Handler = (call: Call) => Reply | Promise<Reply>;

export function fakeHttp(handler: Handler = () => ({ body: {} })) {
  const calls: Call[] = [];
  const service = {
    fetch: async (url: string, init: RequestInit = {}) => {
      const headers = Object.fromEntries(Object.entries((init.headers as Record<string, string>) ?? {}));
      const raw = typeof init.body === 'string' ? init.body : '';
      let body: Record<string, unknown> = {};
      if (raw) {
        try {
          body = headers['Content-Type']?.includes('x-www-form-urlencoded') ? Object.fromEntries(new URLSearchParams(raw)) : JSON.parse(raw);
        } catch {
          body = {};
        }
      }
      const call: Call = { url, method: init.method ?? 'GET', headers, body, raw };
      calls.push(call);
      const reply = await handler(call);
      return new Response(JSON.stringify(reply.body ?? {}), { status: reply.status ?? 200, headers: { 'content-type': 'application/json' } });
    },
  };
  return { service, calls, to: (host: string) => calls.filter((c) => new URL(c.url).host === host) };
}

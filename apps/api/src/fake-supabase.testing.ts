/* Test helper: a stand-in for SupabaseService with scripted responses. */

type Result = { data?: unknown; error?: { message: string; details?: string | null; code?: string } | null; count?: number | null };

/** Any chain of query-builder calls resolves to `result` when awaited. */
function chain(result: Result) {
  const c: unknown = new Proxy(
    {},
    {
      get: (_t, prop) => {
        if (prop === 'then') return (res: (v: Result) => unknown, rej: (e: unknown) => unknown) => Promise.resolve({ data: null, error: null, ...result }).then(res, rej);
        return () => c;
      },
    },
  );
  return c;
}

export interface FakeConfig {
  /** Rows (or errors) returned for any query on a table. */
  tables?: Record<string, Result>;
  /** Responses for rpc(name). */
  rpc?: Record<string, Result>;
  /** Access token -> user. Unknown tokens are rejected. */
  users?: Record<string, { id: string; email: string }>;
  /** Role returned by the profiles lookup. */
  role?: 'customer' | 'admin';
}

export function fakeSupabase(config: FakeConfig = {}) {
  const calls = { rpc: [] as [string, Record<string, unknown> | undefined][], from: [] as string[] };
  const admin = {
    from: (table: string) => {
      calls.from.push(table);
      if (table === 'profiles') return chain({ data: { role: config.role ?? 'customer' } });
      return chain(config.tables?.[table] ?? { data: [] });
    },
    rpc: (name: string, args?: Record<string, unknown>) => {
      calls.rpc.push([name, args]);
      return chain(config.rpc?.[name] ?? { data: null });
    },
    auth: {
      getUser: async (token: string) => {
        const user = config.users?.[token];
        return user ? { data: { user }, error: null } : { data: { user: null }, error: { message: 'invalid' } };
      },
    },
  };
  return { service: { admin }, calls };
}

/**
 * Chainable Supabase mock builder for tests.
 *
 * Usage:
 *   const mock = createMockSupabase({ user: { id: "u1", email: "a@b.com" } });
 *   vi.mocked(createClient).mockResolvedValue(mock.client);
 *   vi.mocked(createAdminClient).mockReturnValue(mock.admin);
 */

import { vi } from "vitest";

interface MockUser {
  id: string;
  email?: string;
}

interface ChainResult {
  data: unknown;
  error: unknown;
  count?: number;
}

/**
 * Creates a chainable query builder mock.
 * You can configure per-table responses via the `tables` map.
 */
function createChainableQuery(defaultResult: ChainResult = { data: null, error: null }) {
  const tables = new Map<string, ChainResult>();

  function makeChain(result: ChainResult): Record<string, unknown> {
    const chain: Record<string, unknown> = {};
    const methods = [
      "select", "insert", "update", "upsert", "delete",
      "eq", "neq", "in", "not", "is",
      "order", "limit", "single", "maybeSingle",
      "gt", "gte", "lt", "lte",
    ];

    for (const method of methods) {
      if (method === "single" || method === "maybeSingle") {
        chain[method] = vi.fn().mockResolvedValue(result);
      } else {
        chain[method] = vi.fn().mockReturnValue(chain);
      }
    }

    // Make the chain itself thenable for queries that don't end with .single()
    chain.then = (resolve: (val: ChainResult) => void) => resolve(result);

    return chain;
  }

  const from = vi.fn((table: string) => {
    const result = tables.get(table) ?? defaultResult;
    return makeChain(result);
  });

  return { from, tables };
}

export function createMockSupabase(opts: { user?: MockUser | null } = {}) {
  const user = opts.user ?? null;

  const authClient = createChainableQuery();
  const adminClient = createChainableQuery();

  const client = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
      }),
    },
    from: authClient.from,
  };

  const admin = {
    from: adminClient.from,
  };

  return {
    client,
    admin,
    /** Configure a response for a specific table on the auth client */
    setAuthTable(table: string, result: ChainResult) {
      authClient.tables.set(table, result);
    },
    /** Configure a response for a specific table on the admin client */
    setAdminTable(table: string, result: ChainResult) {
      adminClient.tables.set(table, result);
    },
  };
}

import { Prisma } from "@prisma/client";
import prisma from "./prisma.js";

export interface WithTenantOptions {
  /**
   * Postgres transaction isolation level. Defaults to the connection default
   * (Read Committed). F4's booking creation passes `"Serializable"` so the
   * availability check + insert see a stable snapshot and concurrent attempts
   * on the same slot cannot both succeed.
   */
  isolationLevel?: Prisma.TransactionIsolationLevel;
  /**
   * How many times to retry the whole transaction when Postgres aborts it with
   * a serialization failure or deadlock. Only meaningful alongside
   * `isolationLevel: "Serializable"`. Defaults to 0 (no retry).
   */
  maxRetries?: number;
}

/**
 * A serialization failure / deadlock is the database telling us "retry the
 * transaction" — it is the expected, correct outcome under SERIALIZABLE
 * contention, not a bug. Prisma surfaces it as P2034 (write conflict / deadlock)
 * or, for raw statements, with the underlying SQLSTATE in `meta.code`
 * (40001 = serialization_failure, 40P01 = deadlock_detected).
 */
function isRetryableTxError(err: unknown): boolean {
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2034") return true;
    const pgCode = (err.meta as { code?: string } | undefined)?.code;
    return pgCode === "40001" || pgCode === "40P01";
  }
  return false;
}

/**
 * Run tenant-scoped database work with PostgreSQL Row-Level Security active.
 *
 * RLS policies key off `current_setting('app.tenant_id')`. Because Prisma uses
 * a connection pool, the tenant id MUST be set on the *same* connection that
 * runs the queries — otherwise the setting lands on a different pooled
 * connection (or is discarded immediately, since `set_config(..., true)` is
 * transaction-local). Wrapping `set_config` + the queries in a single
 * interactive transaction guarantees they share one connection, so the policies
 * see the right tenant.
 *
 * Every handler that touches tenant-scoped tables (Service, Booking, Schedule)
 * must go through this helper. Application-level `where: { tenantId }` filters
 * remain in place as the primary guard; RLS is defense-in-depth that contains
 * the blast radius if a filter is ever forgotten.
 */
export async function withTenant<T>(
  tenantId: string,
  fn: (tx: Prisma.TransactionClient) => Promise<T>,
  options: WithTenantOptions = {}
): Promise<T> {
  const { isolationLevel, maxRetries = 0 } = options;

  for (let attempt = 0; ; attempt++) {
    try {
      return await prisma.$transaction(
        async (tx) => {
          await tx.$executeRaw`SELECT set_config('app.tenant_id', ${tenantId}, true)`;
          return fn(tx);
        },
        // 10 s timeout — longer than the 5 s Prisma default to give F4's
        // SERIALIZABLE availability-check + insert room to succeed under
        // contention.
        { timeout: 10_000, ...(isolationLevel ? { isolationLevel } : {}) }
      );
    } catch (err) {
      if (attempt < maxRetries && isRetryableTxError(err)) {
        // Brief jittered backoff so retrying writers don't lock-step and keep
        // colliding on the same slot.
        await new Promise((r) => setTimeout(r, 25 * (attempt + 1) + Math.random() * 25));
        continue;
      }
      throw err;
    }
  }
}

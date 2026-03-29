import type { PrismaClient, PrismaPromise } from "@prisma/client";

/** Bound Prisma interactive transactions; keeps each transaction a modest size. */
export const SYNC_DB_OPS_PER_TX = 32;

/**
 * Buffers upsert/deleteMany calls and runs them in `prisma.$transaction` chunks.
 * Preserves operation order within each batch (required when upsert + deleteMany pair per day).
 */
export class SyncWriteBatch {
  private readonly ops: PrismaPromise<unknown>[] = [];

  constructor(private readonly prisma: PrismaClient) {}

  add<T>(p: PrismaPromise<T>): void {
    this.ops.push(p as PrismaPromise<unknown>);
  }

  async addAndFlush<T>(p: PrismaPromise<T>): Promise<void> {
    this.add(p);
    if (this.ops.length >= SYNC_DB_OPS_PER_TX) {
      await this.flush();
    }
  }

  async flush(): Promise<void> {
    if (this.ops.length === 0) return;
    await this.prisma.$transaction(this.ops);
    this.ops.length = 0;
  }
}

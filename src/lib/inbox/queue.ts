import { Queue } from "bullmq";
import { prisma } from "../db";
export const QUEUE_NAME = "crm-inbox";
export function redisConnection() {
  const value = process.env.REDIS_URL;
  if (!value) throw new Error("REDIS_URL is required for the inbox worker");
  const url = new URL(value);
  if (!["redis:", "rediss:"].includes(url.protocol)) throw new Error("Invalid Redis protocol");
  return { host: url.hostname, port: Number(url.port || 6379), username: url.username ? decodeURIComponent(url.username) : undefined,
    password: url.password ? decodeURIComponent(url.password) : undefined, db: Number(url.pathname.slice(1) || 0),
    ...(url.protocol === "rediss:" ? { tls: {} } : {}) };
}
export function createInboxQueue() {
  return new Queue(QUEUE_NAME, { connection: { ...redisConnection(), maxRetriesPerRequest: 1, enableOfflineQueue: false },
    defaultJobOptions: { attempts: 5, backoff: { type: "exponential", delay: 2000, jitter: .3 }, removeOnComplete: { count: 20000 }, removeOnFail: { count: 10000 } } });
}
export async function dispatchOutbox(queue: Pick<Queue, "add">) {
  const rows = await prisma.inboxOutboxEvent.findMany({ where: { dispatchedAt: null }, orderBy: { createdAt: "asc" }, take: 50 });
  for (const row of rows) {
    await queue.add(row.kind, { id: row.recordId }, { jobId: row.id });
    await prisma.inboxOutboxEvent.update({ where: { id: row.id }, data: { dispatchedAt: new Date() } });
  }
  return rows.length;
}

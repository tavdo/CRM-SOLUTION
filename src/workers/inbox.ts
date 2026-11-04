import { Worker } from "bullmq";
import { prisma } from "../lib/db";
import { createInboxQueue, dispatchOutbox, QUEUE_NAME, redisConnection } from "../lib/inbox/queue";
import { processWebhook } from "../lib/inbox/processing";
import { sendQueued, downloadAttachment } from "../lib/inbox/sending";

const queue = createInboxQueue();
const worker = new Worker(QUEUE_NAME, async job => {
  const finalAttempt = job.attemptsMade >= (job.opts.attempts || 1) - 1;
  if (job.name === "WEBHOOK") await processWebhook(job.data.id);
  else if (job.name === "SEND") await sendQueued(job.data.id, finalAttempt);
  else if (job.name === "MEDIA") await downloadAttachment(job.data.id, finalAttempt);
}, { connection: redisConnection(), concurrency: 1, limiter: { max: 20, duration: 1000 } });
worker.on("failed", job => console.error(`[inbox.worker] ${job?.name || "job"} failed; inspect its database status`));
worker.on("error", () => console.error("[inbox.worker] queue unavailable"));
queue.on("error", () => console.error("[inbox.worker] queue unavailable"));
let stopping = false;
async function run() {
  while (!stopping) {
    try { await dispatchOutbox(queue); } catch { console.error("[inbox.worker] dispatch unavailable; persisted events retained"); }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
}
async function close() { stopping = true; await worker.close(); await queue.close(); await prisma.$disconnect(); }
process.once("SIGINT", () => void close());
process.once("SIGTERM", () => void close());
void run();

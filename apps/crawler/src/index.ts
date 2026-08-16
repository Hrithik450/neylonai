import { Worker } from "bullmq";
import {
  createBullmqConnection,
  processWebsiteCrawlJob,
  recoverStaleWebsiteCrawlJobs,
  WEBSITE_CRAWL_QUEUE,
  type WebsiteCrawlJobData,
} from "@neylonai/domain/knowledge/crawler";

const concurrency = Math.max(
  1,
  Number(process.env.CRAWL_CONCURRENCY ?? 1) || 1,
);

async function main() {
  const connection = createBullmqConnection();
  const recovered = await recoverStaleWebsiteCrawlJobs();
  if (recovered > 0) {
    console.log(`[crawler] re-enqueued ${recovered} stale crawl job(s)`);
  }

  const worker = new Worker<WebsiteCrawlJobData>(
    WEBSITE_CRAWL_QUEUE,
    async (job) => {
      console.log(`[crawler] start ${job.data.jobId}`);
      await processWebsiteCrawlJob(job.data.jobId);
      console.log(`[crawler] done ${job.data.jobId}`);
    },
    {
      connection,
      concurrency,
      lockDuration: 120_000,
      stalledInterval: 60_000,
    },
  );

  worker.on("failed", (job, error) => {
    console.error(
      `[crawler] failed ${job?.data.jobId ?? job?.id}:`,
      error instanceof Error ? error.message : error,
    );
  });

  const shutdown = async () => {
    await worker.close();
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown());
  process.on("SIGTERM", () => void shutdown());

  console.log(
    `[crawler] listening on ${WEBSITE_CRAWL_QUEUE} (concurrency=${concurrency})`,
  );
}

void main().catch((error) => {
  console.error("[crawler] fatal", error);
  process.exit(1);
});

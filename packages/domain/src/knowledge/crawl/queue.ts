import { Queue, type ConnectionOptions } from "bullmq";

export const WEBSITE_CRAWL_QUEUE = "neylonai-website-crawls";

export type WebsiteCrawlJobData = {
  jobId: string;
};

export function createBullmqConnection(): ConnectionOptions {
  const url = process.env.REDIS_URL;
  if (!url) {
    throw new Error("REDIS_URL is not set in environment variables.");
  }
  const parsed = new URL(url);
  return {
    url,
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    tls: parsed.protocol === "rediss:" ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

let queue: Queue | undefined;

export function getWebsiteCrawlQueue(): Queue {
  if (!queue) {
    queue = new Queue(WEBSITE_CRAWL_QUEUE, {
      connection: createBullmqConnection(),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 8_000 },
        removeOnComplete: { count: 50 },
        removeOnFail: { count: 100 },
      },
    });
  }
  return queue;
}

export async function enqueueWebsiteCrawlJob(jobId: string): Promise<void> {
  await getWebsiteCrawlQueue().add(
    "crawl",
    { jobId } satisfies WebsiteCrawlJobData,
    { jobId, removeOnComplete: { count: 50 } },
  );
}

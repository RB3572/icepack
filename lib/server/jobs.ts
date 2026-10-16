/**
 * In-memory job store.
 *
 * Analysis and design runs take seconds to minutes, so they are started in the
 * background and polled by job id, the way the pages' result URLs expect.
 */
import { randomUUID } from "node:crypto";

export type JobStatus = "running" | "done" | "error";

export interface Job<TInput, TResult> {
  id: string;
  kind: string;
  status: JobStatus;
  createdAt: number;
  finishedAt?: number;
  input: TInput;
  result?: TResult;
  error?: string;
  progress?: string;
}

type AnyJob = Job<unknown, unknown>;

const MAX_JOBS = 60;

declare global {
  var __newerpackJobs: Map<string, AnyJob> | undefined;
}

const store: Map<string, AnyJob> = globalThis.__newerpackJobs ?? new Map();
globalThis.__newerpackJobs = store;

function prune() {
  if (store.size <= MAX_JOBS) return;
  const entries = [...store.values()].sort((a, b) => a.createdAt - b.createdAt);
  for (const entry of entries.slice(0, store.size - MAX_JOBS)) {
    store.delete(entry.id);
  }
}

export function createJob<TInput, TResult>(
  kind: string,
  input: TInput,
  run: (update: (progress: string) => void) => Promise<TResult> | TResult,
): string {
  const id = randomUUID();
  const job: Job<TInput, TResult> = {
    id,
    kind,
    status: "running",
    createdAt: Date.now(),
    input,
  };
  store.set(id, job as AnyJob);
  prune();

  const update = (progress: string) => {
    job.progress = progress;
  };

  // Yield once so the POST returns before the (synchronous, CPU-bound) work.
  setTimeout(() => {
    void (async () => {
      try {
        job.result = await run(update);
        job.status = "done";
      } catch (error) {
        job.status = "error";
        job.error = error instanceof Error ? error.message : String(error);
      }
      job.finishedAt = Date.now();
    })();
  }, 0);

  return id;
}

export function getJob(id: string): AnyJob | undefined {
  return store.get(id);
}

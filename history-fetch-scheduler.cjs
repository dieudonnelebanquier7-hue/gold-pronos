'use strict';

async function mapRateLimited(items, worker, options = {}) {
  if (!Array.isArray(items)) throw new TypeError('items must be an array');
  if (typeof worker !== 'function') throw new TypeError('worker must be a function');

  const requestedConcurrency = Number(options.concurrency ?? 1);
  const concurrency = Number.isFinite(requestedConcurrency)
    ? Math.max(1, Math.floor(requestedConcurrency))
    : 1;
  const requestedInterval = Number(options.minIntervalMs ?? 0);
  const minIntervalMs = Number.isFinite(requestedInterval)
    ? Math.max(0, Math.floor(requestedInterval))
    : 0;

  const results = new Array(items.length);
  let cursor = 0;
  let nextStartAt = 0;

  async function waitForRequestSlot() {
    const now = Date.now();
    const scheduledAt = Math.max(now, nextStartAt);
    nextStartAt = scheduledAt + minIntervalMs;
    const delay = scheduledAt - now;
    if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
  }

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      await waitForRequestSlot();
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

module.exports = { mapRateLimited };

'use strict';

const assert = require('node:assert/strict');
const { mapRateLimited } = require('./history-fetch-scheduler.cjs');

(async () => {
  const input = Array.from({ length: 12 }, (_, index) => index);
  const starts = [];
  let active = 0;
  let maxActive = 0;

  const output = await mapRateLimited(input, async value => {
    starts.push(Date.now());
    active++;
    maxActive = Math.max(maxActive, active);
    await new Promise(resolve => setTimeout(resolve, 100));
    active--;
    return value * 2;
  }, { concurrency: 3, minIntervalMs: 20 });

  assert.deepEqual(output, input.map(value => value * 2),
    'results must preserve the input order');
  assert.ok(maxActive > 1 && maxActive <= 3,
    'worker concurrency must be greater than one and never exceed the configured limit');

  const orderedStarts = [...starts].sort((a, b) => a - b);
  for (let index = 1; index < orderedStarts.length; index++) {
    const spacing = orderedStarts[index] - orderedStarts[index - 1];
    assert.ok(spacing >= 15,
      'request starts must respect the configured global interval (observed '+spacing+'ms)');
  }

  console.log('History fetch scheduler test: OK ('+input.length+
    ' requests; max '+maxActive+' concurrent; globally rate-limited starts).');
})().catch(error => {
  console.error(error);
  process.exitCode = 1;
});

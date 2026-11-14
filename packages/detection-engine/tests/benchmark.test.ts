import { cpus, platform, arch } from 'node:os';
import { performance } from 'node:perf_hooks';
import { expect, it } from 'vitest';
import { scan } from '../src';
it('benchmarks a synthetic 10 KB mixed payload', () => {
  const text =
    `ordinary synthetic text\nAPI_KEY="synthetic-value"\n${'x'.repeat(100)}\n`
      .repeat(70)
      .slice(0, 10000);
  for (let i = 0; i < 100; i++) scan(text);
  const times = Array.from({ length: 500 }, () => {
    const start = performance.now();
    scan(text);
    return performance.now() - start;
  }).sort((a, b) => a - b);
  console.info(
    JSON.stringify({
      benchmark: 'synthetic-10KB',
      samples: 500,
      p95Ms: times[474],
      node: process.version,
      platform: platform(),
      arch: arch(),
      cpu: cpus()[0]?.model,
    }),
  );
  expect(times[474]).toBeLessThan(50);
});

import { describe, expect, it } from 'vitest';
import {
  redact,
  scan,
  type DetectionEngine,
  type Detector,
  type Finding,
  type ScanResult,
  type Severity,
} from '@promptknight/detection-engine';

describe('Public package API', () => {
  const engine: DetectionEngine = { scan, redact };

  it('returns an empty, untruncated result through the package export', () => {
    const result: ScanResult = engine.scan('');
    expect(result).toEqual({ findings: [], truncated: false });
  });

  it.each([
    'ordinary text',
    '',
    'Hello 🛡️\nsecond line\r\n',
    '{"message":"hello"}',
  ])('preserves clean text exactly: %j', (text) => {
    expect(engine.redact(text, [])).toBe(text);
    expect(engine.scan(text)).toEqual({ findings: [], truncated: false });
  });

  it('returns independent result containers', () => {
    const severity: Severity = 'low';
    const finding: Finding = {
      id: 'synthetic',
      type: 'synthetic',
      severity,
      start: 0,
      end: 1,
      replacement: '[SYNTHETIC_1]',
    };
    const detector: Detector = { id: 'synthetic', detect: () => [finding] };
    const first = engine.scan('ordinary text');
    first.findings.push(...detector.detect('x'));
    expect(engine.scan('ordinary text').findings).toEqual([]);
  });
});

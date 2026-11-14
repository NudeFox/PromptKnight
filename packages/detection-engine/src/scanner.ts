import { defaultDetectors } from './detectors';
import type { Finding, ScanResult, Severity } from './types';

/** Maximum synchronous input size in UTF-16 code units. Never scan a partial secret. */
export const MAX_SCAN_LENGTH = 100_000;
const rank: Record<Severity, number> = { high: 3, medium: 2, low: 1 };

export function scan(text: string): ScanResult {
  if (text.length > MAX_SCAN_LENGTH) {
    return { findings: [], truncated: true, warnings: ['SCAN_LIMIT_EXCEEDED'] };
  }
  const candidates = defaultDetectors.flatMap((detector, priority) =>
    detector.detect(text).map((finding) => ({ finding, priority })),
  );
  candidates.sort(
    (a, b) =>
      rank[b.finding.severity] - rank[a.finding.severity] ||
      b.finding.end - b.finding.start - (a.finding.end - a.finding.start) ||
      a.priority - b.priority ||
      a.finding.start - b.finding.start,
  );
  // Occupancy bounds overlap resolution to O(input size + total candidate lengths).
  const occupied = new Uint8Array(text.length);
  const accepted: Finding[] = [];
  for (const { finding } of candidates) {
    if (occupied.subarray(finding.start, finding.end).some(Boolean)) continue;
    occupied.fill(1, finding.start, finding.end);
    accepted.push(finding);
  }
  accepted.sort((a, b) => a.start - b.start);
  const counts = new Map<string, number>();
  for (const finding of accepted) {
    const count = (counts.get(finding.type) ?? 0) + 1;
    counts.set(finding.type, count);
    finding.id = `${finding.type}_${count}`;
    finding.replacement = `[${finding.id}]`;
    // Keep URL delimiters outside the replacement.
    if (finding.type === 'DATABASE_CREDENTIALS') finding.end -= 1;
    if (finding.type === 'ENV_SECRET' && /^['"]/.test(text[finding.start]!)) {
      finding.start += 1;
      finding.end -= 1;
    }
  }
  return { findings: accepted, truncated: false };
}

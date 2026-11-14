import type { Finding } from './types';

/** Reject invalid or overlapping ranges rather than return partially sanitized text. */
export function redact(text: string, findings: Finding[]): string {
  const ordered = [...findings].sort((a, b) => a.start - b.start);
  let previousEnd = 0;
  for (const finding of ordered) {
    if (
      !Number.isInteger(finding.start) ||
      !Number.isInteger(finding.end) ||
      finding.start < previousEnd ||
      finding.end <= finding.start ||
      finding.end > text.length ||
      !/^\[[A-Z][A-Z0-9_]*_\d+\]$/.test(finding.replacement)
    ) {
      throw new Error('Invalid redaction finding');
    }
    previousEnd = finding.end;
  }
  let result = text;
  for (const finding of ordered.reverse()) {
    result =
      result.slice(0, finding.start) +
      finding.replacement +
      result.slice(finding.end);
  }
  return result;
}

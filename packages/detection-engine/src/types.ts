export type Severity = 'low' | 'medium' | 'high';

export interface Finding {
  id: string;
  type: string;
  severity: Severity;
  /** UTF-16 code-unit offset, inclusive. */
  start: number;
  /** UTF-16 code-unit offset, exclusive. */
  end: number;
  replacement: string;
}

export interface ScanResult {
  findings: Finding[];
  truncated: boolean;
  /** Diagnostic messages must never contain sensitive values. */
  warnings?: string[];
}

export interface Detector {
  readonly id: string;
  detect(text: string): Finding[];
}

export interface DetectionEngine {
  scan(text: string): ScanResult;
  redact(text: string, findings: Finding[]): string;
}

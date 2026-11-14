import { describe, expect, it } from 'vitest';
import { MAX_SCAN_LENGTH, scan, redact, type Finding } from '../src';
const github = `ghp_${'Ab12'.repeat(9)}`;
const openai = `sk-proj-${'Ab12'.repeat(12)}`;
const jwt = `${btoa('{"alg":"HS256"}').replace(/=/g, '')}.${btoa('{"sub":"synthetic"}').replace(/=/g, '')}.c3ludGhldGlj`;
const pem = `-----BEGIN RSA PRIVATE KEY-----\n${'QUJD'.repeat(16)}\n-----END RSA PRIVATE KEY-----`;

describe('default detectors', () => {
  it.each([
    [github, 'GITHUB_TOKEN'],
    [`github_pat_${'A'.repeat(22)}_${'b'.repeat(59)}`, 'GITHUB_TOKEN'],
    [openai, 'OPENAI_TOKEN'],
    [`AKIA${'A1'.repeat(8)}`, 'AWS_ACCESS_KEY_ID'],
    [jwt, 'JWT'],
    [pem, 'PEM_PRIVATE_KEY'],
    [
      'postgresql://synthetic:password@localhost:5432/db',
      'DATABASE_CREDENTIALS',
    ],
    ['export API_KEY="synthetic-value"', 'ENV_SECRET'],
    ['SECRET=synthetic-value', 'ENV_SECRET'],
  ])('detects synthetic %s', (text, type) => {
    const result = scan(text);
    expect(result.findings).toHaveLength(1);
    expect(result.findings[0]?.type).toBe(type);
    expect(result.truncated).toBe(false);
    expect(JSON.stringify(result)).not.toContain(text);
  });
  it.each([
    'ghp_short sk-short AKIA1234',
    'a.b.c',
    'eyJhbGciOiJub25lIn0.e30.abc',
    'PORT=3000\nDEBUG=true\nAPI_KEY=\nSECRET=""',
    'TOKEN=${TOKEN}\nPASSWORD=changeme',
    'person@example.com 192.168.1.1 4111111111111111',
    'postgres://localhost/db',
    'postgres://user@localhost/db',
    pem.replace('END RSA', 'END EC'),
  ])('ignores lookalikes and optional categories: %s', (text) => {
    expect(scan(text).findings).toEqual([]);
  });
  it('preserves quotes, URL structure, CRLF, emoji and stable numbering', () => {
    const text = `🛡️\r\nAPI_KEY="${github}"\r\n${github}\nredis://user:pass@localhost/0`;
    const result = scan(text);
    expect(scan(text)).toEqual(result);
    expect(result.findings.map((f) => text.slice(f.start, f.end))).toEqual([
      github,
      github,
      'user:pass',
    ]);
    expect(redact(text, result.findings)).toBe(
      '🛡️\r\nAPI_KEY="[ENV_SECRET_1]"\r\n[GITHUB_TOKEN_1]\nredis://[DATABASE_CREDENTIALS_1]@localhost/0',
    );
  });
  it('handles JSON, stack traces and repeated scans without shared regex state', () => {
    const text =
      JSON.stringify({ key: github }) + `\n at synthetic.ts:1\n${github}`;
    for (let i = 0; i < 3; i++) expect(scan(text).findings).toHaveLength(2);
  });
  it('fails closed on oversized input without returning partial findings', () => {
    expect(scan('x'.repeat(MAX_SCAN_LENGTH + 1))).toEqual({
      findings: [],
      truncated: true,
      warnings: ['SCAN_LIMIT_EXCEEDED'],
    });
    expect(scan('x'.repeat(MAX_SCAN_LENGTH)).truncated).toBe(false);
  });
  it('finishes adversarial bounded inputs', () => {
    for (const text of [
      'a'.repeat(MAX_SCAN_LENGTH),
      '.'.repeat(MAX_SCAN_LENGTH),
      'API_KEY="'.repeat(10000),
      '-----BEGIN PRIVATE KEY-----\n' + 'A'.repeat(90000),
    ]) {
      expect(scan(text).truncated).toBe(false);
    }
  }, 2000);
});

describe('redaction validation', () => {
  const finding: Finding = {
    id: 'X_1',
    type: 'X',
    severity: 'high',
    start: 1,
    end: 3,
    replacement: '[X_1]',
  };
  it.each([
    { start: -1 },
    { end: 10 },
    { start: 1.2 },
    { end: 1 },
    { start: NaN },
    { replacement: 'unsafe' },
  ])('rejects invalid ranges or replacements', (change) => {
    expect(() => redact('abcd', [{ ...finding, ...change }])).toThrow(
      'Invalid redaction finding',
    );
  });
  it('rejects overlap without leaking the source in its error', () => {
    expect(() => redact('abcd', [finding, finding])).toThrow(
      'Invalid redaction finding',
    );
  });
  it('accepts unsorted adjacent findings without mutating them', () => {
    const input = [{ ...finding, start: 3, end: 4 }, finding];
    expect(redact('abcd', input)).toBe('a[X_1][X_1]');
    expect(input[0]?.start).toBe(3);
  });
});

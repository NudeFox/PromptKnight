import type { Detector, Finding, Severity } from '../types';

function patternDetector(
  id: string,
  pattern: RegExp,
  severity: Severity,
  group = 0,
  validate: (value: string) => boolean = () => true,
): Detector {
  return {
    id,
    detect(text) {
      const findings: Finding[] = [];
      for (const match of text.matchAll(
        new RegExp(pattern.source, pattern.flags + 'd'),
      )) {
        const value = match[group];
        if (!value || !validate(value)) continue;
        const start = match.indices![group]![0];
        findings.push({
          id,
          type: id,
          severity,
          start,
          end: start + value.length,
          replacement: '',
        });
      }
      return findings;
    },
  };
}

function validJwt(value: string): boolean {
  try {
    const [header, payload] = value.split('.');
    const decode = (segment: string) => {
      if (segment.length % 4 === 1) throw new Error('Invalid encoding');
      const base64 = segment.replace(/-/g, '+').replace(/_/g, '/');
      return JSON.parse(atob(base64)) as unknown;
    };
    const h = decode(header!);
    const p = decode(payload!);
    return (
      typeof h === 'object' &&
      h !== null &&
      'alg' in h &&
      typeof h.alg === 'string' &&
      h.alg !== 'none' &&
      typeof p === 'object' &&
      p !== null &&
      !Array.isArray(p)
    );
  } catch {
    return false;
  }
}

/** Order breaks ties after severity; enclosing structured secrets win at equal severity. */
export const defaultDetectors: readonly Detector[] = [
  patternDetector(
    'PEM_PRIVATE_KEY',
    /-----BEGIN (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----\r?\n[A-Za-z0-9+/=\r\n]+\r?\n-----END (?:RSA |EC |DSA |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/g,
    'high',
    0,
    (value) => {
      const lines = value.split(/\r?\n/);
      return (
        lines[0]?.replace('BEGIN', 'END') === lines.at(-1) &&
        lines.slice(1, -1).join('').length >= 32
      );
    },
  ),
  patternDetector(
    'GITHUB_TOKEN',
    /\b(?:gh[pousr]_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9]{22}_[A-Za-z0-9]{59})\b/g,
    'high',
  ),
  patternDetector(
    'OPENAI_TOKEN',
    /\bsk-(?:(?:proj|svcacct)-)?[A-Za-z0-9_-]{20,256}/g,
    'high',
    0,
    (value) => /[A-Z]/.test(value) && /[0-9]/.test(value),
  ),
  patternDetector(
    'DATABASE_CREDENTIALS',
    /\b(?:postgres(?:ql)?|mysql|mongodb(?:\+srv)?|redis|rediss|mssql):\/\/([^\s/"'<>]+@)/gi,
    'high',
    1,
    (value) => {
      try {
        const url = new URL(`postgres://${value}example.invalid`);
        return Boolean(url.username && url.password);
      } catch {
        return false;
      }
    },
  ),
  patternDetector(
    'ENV_SECRET',
    /(?:^|\n)[ \t]*(?:export[ \t]+)?(?=[A-Za-z0-9_]*(?:SECRET|TOKEN|PASSWORD|PASSWD|API_KEY|PRIVATE_KEY|ACCESS_KEY))[A-Za-z_][A-Za-z0-9_]*[ \t]*=[ \t]*("[^"\r\n]+"|'[^'\r\n]+'|[^\s#"']+)/g,
    'high',
    1,
    (value) =>
      !/^(?:""|''|(?:"|')?(?:true|false|null|undefined|changeme|your[_-].*|\$\{.*\})(?:"|')?)$/i.test(
        value,
      ),
  ),
  patternDetector(
    'AWS_ACCESS_KEY_ID',
    /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
    'medium',
  ),
  patternDetector(
    'JWT',
    /(?<![A-Za-z0-9_-])[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+(?![A-Za-z0-9_-])/g,
    'medium',
    0,
    validJwt,
  ),
];

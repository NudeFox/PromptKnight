# M02 detection engine verification

Implemented seven default categories without browser, framework, storage or network dependencies.
Fixtures are synthetic. Findings contain category metadata, UTF-16 ranges and numbered tokens;
no raw values or hashes. Numbering restarts per category on each scan, in source order.

Overlap priority: high severity before medium before low, then longest enclosing range,
then detector declaration order, then earliest position. Thus a quoted `.env` value
containing a token is redacted as one ENV_SECRET. URL credential replacements preserve
scheme, host, port, path and the `@`; quoted env values preserve their quotes. Redaction
rejects invalid, overlapping or out-of-bounds ranges and malformed replacement tokens
with a fixed error message. It does not mutate caller findings.

Rules are heuristic: GitHub classic and fine-grained formats; OpenAI-style prefix and
20–256 character body with uppercase/digit checks; AKIA/ASIA IDs; JWT JSON header with
an algorithm other than `none`, object payload and signature segment; matching multiline
PEM private-key markers and base64-looking body; credential-bearing database URLs;
nonempty sensitive env assignments. These do not authenticate credentials, verify JWT
signatures or parse cryptographic keys. OpenAI formats and env names can produce false
positives/negatives. PEM metadata headers and multiline env values are not supported.
Email, IP and card detection are deliberately absent from the default engine.

Maximum scan length: 100,000 UTF-16 code units. Larger input returns no partial findings,
`truncated: true`, and fixed `SCAN_LIMIT_EXCEEDED` warning. Consumers must block or require
an explicit decision on incomplete results; an empty findings list alone is insufficient.
Paste integration and scan-failure UI remain M03 work.

Benchmark: Node v24.14.0, macOS x64, Intel Core i5-8500 @ 3.00 GHz. A synthetic
10,000-code-unit mixed prose/env payload, 100 warmups and 500 timed synchronous scans,
yielded p95 **0.225 ms** without coverage instrumentation. This is a local measurement,
not a guarantee for every payload or machine. The benchmark test checks the 50 ms target.
Bounded adversarial tests cover long words, dots, repeated unclosed assignments and PEM.

Validation: 37 tests passed; V8 coverage 98.59% statements, 100% branches/functions.
ESLint, strict package/app typechecks and production MV3 build passed using installed
local binaries (pnpm was not on PATH). No dependencies or permissions were added.
Browser UI smoke testing was not repeated because M02 changes only the standalone engine.

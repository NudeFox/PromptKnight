# Threat model

## Current boundary

Assets include future clipboard text, user decisions, and site permissions. The host
page and pasted content must be treated as untrusted. The browser, extension runtime,
and installed dependencies form part of the trusted computing base.

The extension has no clipboard access, paste listener, storage, content script, or
requested permissions. Its standalone engine scans only text explicitly passed by a
caller and is not connected to browser paste events. A misleading protection claim
is therefore a current risk: the popup and README explicitly state protection
is inactive. Build dependencies may use the network during installation; the production
extension has no application network functionality.

## Engine safeguards and limits

Scanning is bounded to 100,000 UTF-16 code units; oversized inputs return an explicit
incomplete result. Findings contain metadata and ranges rather than raw values.
Redaction rejects invalid or overlapping ranges. Synthetic tests exercise false
positives, Unicode offsets and hostile input shapes. These checks do not prove that
all secrets will be detected. See [Detection engine](detection-engine.md) for rule limits.

## Browser integration requirements

- Accidental disclosure through paste: synchronous local scanning and explicit choices;
  heuristics still produce false positives and false negatives.
- Malicious clipboard text and DOM injection: plain-text rendering, never untrusted HTML.
- Host-page CSS/JS interference: isolated UI, tested focus behavior, and bounded trust claims.
- Permission overreach and stale scripts: explicit per-origin grants and reconciliation
  after revocation, startup, and site removal.
- Large payloads and regex denial of service: bounded synchronous input, adversarial tests,
  failure warnings, and no silent safe verdict when scanning fails.
- Logs, screenshots, diagnostics, and storage leaks: no raw text in logs, persisted findings,
  preview exports, telemetry, or network calls; synthetic samples only.
- Rich-text editors, iframes, and alternate input paths: test supported adapters, document
  unsupported contexts, and never imply comprehensive DLP.
- Clipboard lifetime: retain original text only for the pending decision and release
  references afterward; JavaScript cannot guarantee memory wiping.

Typing, drag-and-drop, file uploads, screenshots, voice, programmatic changes, and
unavailable editors are outside paste-only coverage. A malicious authorized page can
read text that the user explicitly inserts. Local-first does not mean infallible.

The browser integration items above are design requirements, not implemented
protection properties. Revisit this model as paste handling, permissions and release
work are implemented.

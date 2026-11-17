# Architecture

PromptKnight is a pnpm workspace. TypeScript runs in strict mode, ESLint uses a flat
configuration with React hooks rules, Prettier handles formatting, and Vitest exercises
the detection package's public export. CI installs from the lockfile and runs lint,
format checks, typecheck, tests, and the production build with read-only token permissions.

The WXT app uses its supported React module. The MV3 background remains empty.
The popup uses temporary `activeTab` access from the toolbar invocation and `scripting`
to inject `protection.js` on request. There are no persistent host grants, manifest
content-script matches, clipboard permissions, storage or runtime network calls.

The injected isolated-world script installs one capture-phase paste listener in the
main page. The paste controller coordinates synchronous scans, transient decisions,
a closed Shadow DOM native dialog, and selection-aware editor adapters. Reinjection
replaces the previous instance; disable removes listeners and cancels pending decisions.
Popup messages contain status/disable commands only, never text or findings. See
[paste protection](paste-protection.md) for behavior, test fixtures and limits.

`@promptknight/detection-engine` exports public TypeScript types and named
`scan` and `redact` functions. It has no runtime dependencies. Offsets are documented
as UTF-16 code units. The scanner implements seven local detector categories, bounded scans and deterministic
overlap resolution; redaction validates ranges and preserves UTF-16 offsets. See
[Detection engine](detection-engine.md) for rule limits and measurements. Source exports are bundled by
workspace consumers rather than published as compiled packages.

Persistent per-origin settings, permission reconciliation and extension-loading E2E
remain planned work. Browser fixture acceptance is outstanding in the restricted
implementation environment. Keep raw values out of findings, logs, persistent storage
and network payloads. Render untrusted text as text nodes.

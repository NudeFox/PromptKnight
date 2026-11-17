# Architecture

PromptKnight is a pnpm workspace. TypeScript runs in strict mode, ESLint uses a flat
configuration with React hooks rules, Prettier handles formatting, and Vitest exercises
the detection package's public export. CI installs from the lockfile and runs lint,
format checks, typecheck, tests, and the production build with read-only token permissions.

The WXT app uses its supported React module. The popup imports product metadata from
`@promptknight/shared`. The MV3 background is deliberately empty. There are no content
scripts, host permissions, clipboard permissions, storage, runtime network calls, or
paste listeners. The popup explicitly states that protection is inactive.

`@promptknight/detection-engine` exports public TypeScript types and named
`scan` and `redact` functions. It has no runtime dependencies. Offsets are documented
as UTF-16 code units. The scanner implements seven local detector categories, bounded scans and deterministic
overlap resolution; redaction validates ranges and preserves UTF-16 offsets. See
[Detection engine](detection-engine.md) for rule limits and measurements. Source exports are bundled by
workspace consumers rather than published as compiled packages.

Future milestones will add transient paste decisions,
and explicitly granted origin access. Those designs require separate verification;
the current extension does not provide paste protection. Keep raw values out of findings,
logs, persistent storage, and network payloads. Render untrusted text as text nodes.

# PromptKnight

Local-first protection for sensitive text — **M02 development preview**.

This repository currently provides a React popup and a local detection/redaction engine.
**Paste protection is not active.** Nothing scans, intercepts, or redacts your clipboard.
The extension requests no permissions or host access.

## Requirements and setup

Use Node.js 24 LTS and pnpm 10.28.2 (pinned in `package.json`). Install pnpm with
`npm install --global pnpm@10.28.2`, or use Corepack if available.

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
```

Load the production build in Chrome:

1. Open `chrome://extensions` and enable Developer mode.
2. Choose **Load unpacked** and select `apps/extension/.output/chrome-mv3`.
3. Pin PromptKnight and click its toolbar icon.
4. Confirm the popup displays **PromptKnight**, **Local-first protection for sensitive text**,
   **Development preview**, and the inactive-protection notice.
5. Check that the extension reports no errors and requires no website access.

For development, run `pnpm dev` (WXT launches a development browser). Development
builds may include WXT development tooling; inspect the production build for release permissions.
`pnpm format` applies formatting. Generated WXT types are prepared during installation
and again by `pnpm typecheck`.

## Workspace design

- `apps/extension`: WXT Manifest V3 app with the official React module, popup, and no-op background.
- `packages/detection-engine`: framework-independent TypeScript types and working `scan`/`redact` functions.
- `packages/shared`: shared product metadata consumed through a workspace export.
- `docs`: draft architecture and threat model.

Workspace exports point to TypeScript source for consumption by WXT/Vite and Vitest;
these private packages are not standalone published JavaScript distributions.
`scan` returns deterministic, non-overlapping findings without raw values. `redact`
validates ranges and applies numbered replacement tokens. Inputs above 100,000 UTF-16
code units return `truncated: true`; callers must treat this as an incomplete scan.

## Scope and roadmap

M01 and M02 are implemented. The engine detects GitHub/OpenAI-style tokens, potential AWS
access IDs, JWT candidates, PEM private keys, database URL credentials and `.env` secrets.
Email, IPv4 and card detectors remain disabled/unimplemented optional follow-ups.
See [M02 verification](docs/m02-verification.md) for rules, limits and measurements.
Paste interception and warning UI belong to M03; site permissions/settings to M04.
No content scripts, backend, telemetry, remote executable code, or store release are included.

Even the intended MVP is heuristic paste assistance, not comprehensive data-loss prevention.
Typing, drag-and-drop, files, screenshots, voice, programmatic changes, complex editors,
and cross-origin frames can bypass paste-only protection. Local operation does not guarantee
that all sensitive text will be detected.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md),
[architecture](docs/architecture.md), and [threat model](docs/threat-model.md).
Licensed under [MIT](LICENSE).

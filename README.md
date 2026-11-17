# PromptKnight

Local-first protection for sensitive text — **Development preview**.

PromptKnight checks trusted text pastes locally in supported editors on pages you enable.
When potential secrets are found, choose **Paste redacted**, **Paste original** or **Cancel**.
Checks are off until you enable the current page from the toolbar. Reloading or navigating
requires enabling again. Complex editors and frames are unsupported; browser acceptance
checks remain outstanding in this development preview.

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
4. Open an HTTPS page (or localhost), click the toolbar icon, then **Enable on this page**.
5. In a supported text field, paste `API_KEY=synthetic-demo-value` and check the warning's
   Redacted, Original and Cancel actions. Test ordinary text and Escape cancellation too.
6. Choose **Disable on this page** to remove checks. Reloading also requires enabling again.

No persistent website access or clipboard permission is requested. The toolbar action
provides temporary access to the current page; `scripting` installs its local checker.
See [paste protection](docs/paste-protection.md) for supported editors and limitations.

For development, run `pnpm dev` (WXT launches a development browser). Development
builds may include WXT development tooling; inspect the production build for release permissions.
`pnpm format` applies formatting. Generated WXT types are prepared during installation
and again by `pnpm typecheck`.

## Workspace design

- `apps/extension`: WXT Manifest V3 app with the official React module, popup, and no-op background.
- `packages/detection-engine`: framework-independent TypeScript types and working `scan`/`redact` functions.
- `packages/shared`: shared product metadata consumed through a workspace export.
- `docs`: architecture, detection rules and threat model.

Workspace exports point to TypeScript source for consumption by WXT/Vite and Vitest;
these private packages are not standalone published JavaScript distributions.
`scan` returns deterministic, non-overlapping findings without raw values. `redact`
validates ranges and applies numbered replacement tokens. Inputs above 100,000 UTF-16
code units return `truncated: true`; callers must treat this as an incomplete scan.

## Scope and roadmap

The standalone engine detects GitHub/OpenAI-style tokens, potential AWS
access IDs, JWT candidates, PEM private keys, database URL credentials and `.env` secrets.
Email, IPv4 and card detectors remain disabled/unimplemented optional follow-ups.
See [Detection engine](docs/detection-engine.md) for rules, limits and measurements.
Per-site permissions/settings and further browser hardening are planned in the
[roadmap](ROADMAP.md). No backend, telemetry, remote executable code or store release is included.

Run `pnpm test:browser` for local Chrome clipboard fixtures, or `pnpm fixtures` for manual
testing. Set `CHROME_PATH` if needed. These tests require permission to launch Chrome and
listen on localhost. See [privacy](docs/privacy.md) for data handling.

Even the intended MVP is heuristic paste assistance, not comprehensive data-loss prevention.
Typing, drag-and-drop, files, screenshots, voice, programmatic changes, complex editors,
and cross-origin frames can bypass paste-only protection. Local operation does not guarantee
that all sensitive text will be detected.

See [CONTRIBUTING.md](CONTRIBUTING.md), [SECURITY.md](SECURITY.md),
[architecture](docs/architecture.md), and [threat model](docs/threat-model.md).
Licensed under [MIT](LICENSE).

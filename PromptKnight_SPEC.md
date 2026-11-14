# PromptKnight — Product & Engineering Specification

**Status:** Implementation-ready specification  
**Version:** 1.0 (MVP target)  
**Product:** Open-source, local-first Chrome extension  
**License:** MIT  
**Stack:** React, TypeScript, WXT, Chrome Manifest V3, pnpm workspaces, Vitest, Playwright, GitHub Actions

> **Codex instruction:** Implement this specification incrementally. Finish and verify each milestone before advancing. Do not claim a security guarantee that the browser extension cannot technically provide. Prefer a working, narrowly scoped MVP to speculative features.

## 1. Purpose and success criteria

PromptKnight warns users when they attempt to paste potentially sensitive text into AI chats or websites they explicitly authorize. Detection and redaction happen **locally**. Users can choose **Paste redacted**, **Paste original**, or **Cancel**. The primary aim is a polished, useful, public GitHub project, with a Chrome Web Store release and an extensible codebase. Monetization is out of scope for MVP.

Success criteria:

- A third party can clone, install, build, test, and run the extension using the README.
- Users can enable protection on ChatGPT, Claude, Gemini, and manually approved HTTPS origins.
- Detected text is stopped **before** the browser's default paste; the user explicitly selects an action.
- Raw pasted text and findings' raw values are never sent to a server, stored persistently, or printed to logs.
- The extension does not request blanket persistent access to all websites.
- Detection engine is independent of React, the DOM, WXT, and Chrome APIs.
- CI validates lint, typecheck, tests, and production build.
- A downloadable release ZIP and accurate Chrome Web Store listing/privacy disclosure are prepared.

**Non-goal:** comprehensive data-loss prevention. Paste-only interception does not cover typing, drag-and-drop, file uploads, screenshots, voice input, programmatic editor changes, or all custom editors. State limitations prominently.

## 2. User stories and scope

### P0 — MVP

1. **Enable protection:** User opens popup, sees enabled/disabled status and supported origins.
2. **AI-site presets:** ChatGPT, Claude, and Gemini have discoverable presets. Request per-origin access only after a user gesture, not on install.
3. **Custom sites:** User can enter a valid HTTPS origin, explicitly grant permission, remove it later, and see the actual permission state.
4. **Paste detection:** On a supported editor on an enabled origin, capture a trusted user-initiated text paste in the capture phase; scan before native insertion.
5. **No findings:** Allow default paste without changing behavior.
6. **Findings:** Cancel the default paste synchronously, present a non-leaking warning dialog with categories, severity, and redacted preview.
7. **Choices:** **Paste redacted** inserts sanitized text; **Paste original** inserts the original explicitly; **Cancel** leaves editor unchanged.
8. **Safe UI behavior:** Escape/close cancel; no auto-insert on dialog dismissal; accessible keyboard navigation and restored focus.
9. **Local operation:** No backend, analytics, tracking, remote rule downloads, or remote executable code.
10. **Docs and tests:** Strong unit tests, browser fixtures, threat model, privacy policy, release instructions.

### P1 — Good follow-up

- Optional category toggles and sensitivity level (default high-confidence secrets only).
- Site-specific settings, local aggregate counts without text.
- Developer-friendly JSON, `.env`, and URL masking that preserves structure.
- More robust adapter support for React-controlled, ProseMirror, Slate, and other rich-text editors.

### P2 — Out of MVP

- Custom regex detectors and rule import/export.
- Pre-send checks on supported sites (separate threat model).
- File, image, clipboard-history or continuous-input monitoring.
- Cloud sync, team policy, payments, local LLMs.

## 3. Detection and redaction

### 3.1 Categories (progressively implement with synthetic fixtures)

| Detector | Detection approach | Default |
|---|---|---|
| GitHub tokens (`ghp_`, `github_pat_`, etc.) | Format/prefix plus length/character validation | On |
| OpenAI-style API tokens | Format-aware matching, cautious validation; avoid matching prefix alone | On |
| AWS Access Key IDs | Known prefix and structural validation; flag as *potential* secret | On |
| JWT | Three base64url-looking segments; syntax validation; treat as candidate | On |
| PEM private keys | Boundary markers and multiline structure | On |
| Credentials in database URLs | URL parser where possible; redact username/password, preserve host and scheme unless sensitive | On |
| `.env` secrets | Recognize sensitive variable names and nonempty values without masking ordinary configuration | On |
| Emails | Explicitly optional because of false positives | Off |
| IPv4 | Explicitly optional; distinguish private/local addresses | Off |
| Card numbers | Luhn-based *candidate* detector only; privacy and false-positive review | Off |

**Security model:** Detection is heuristic, not validation of whether a credential is active. Do not call third-party services to verify secrets.

### 3.2 Public TypeScript API

```ts
export type Severity = 'low' | 'medium' | 'high';

export interface Finding {
  id: string;
  type: string;
  severity: Severity;
  start: number; // UTF-16 code-unit offset
  end: number;   // exclusive UTF-16 code-unit offset
  replacement: string;
}

export interface ScanResult {
  findings: Finding[];
  truncated: boolean;
  warnings?: string[]; // no raw sensitive values
}

export interface Detector {
  readonly id: string;
  detect(text: string): Finding[];
}

export interface DetectionEngine {
  scan(text: string): ScanResult;
  redact(text: string, findings: Finding[]): string;
}
```

Use deterministic, non-overlapping findings and stable replacement tokens such as `[GITHUB_TOKEN_1]`. Resolve overlaps by documented severity/specificity/length priorities. Validate bounds and apply replacements from the end of the string. Avoid retaining secret substrings inside findings or errors. Respect JavaScript UTF-16 offsets and test emoji/surrogates, multiline text, repeated values, and overlapping patterns.

### 3.3 Performance and failure behavior

- Target p95 scan <50 ms for <=10 KB on a documented development machine; benchmark before claiming it.
- Establish a maximum synchronous scan length (initial suggestion 100 KB). If exceeded, **do not silently allow**. Block default paste and offer an explicit warning/decision or cancellation.
- Avoid catastrophic-backtracking regexes; add hostile long-input tests.
- If scan fails, cancel the paste and offer a clear unavailable-protection warning and explicit original/cancel action. Never silently imply content was safe.
- Never write raw clipboard content to console, browser storage, telemetry, crash reporting, or exported diagnostics.

## 4. Browser interaction and permissions

### 4.1 Sites

- Built-in presets: ChatGPT, Claude, Gemini. Confirm currently used HTTPS origins during implementation; maintain them as narrowly scoped constants, not broad wildcard site matches.
- User sites: accept exact HTTPS origins (scheme + hostname + optional port); reject credentials, paths as permission scope, `javascript:`, `file:`, `chrome:`, and wildcard patterns from user input. Normalize safely and explain why access is needed.
- Permissions: `storage` and `scripting` if needed; host access requested with `chrome.permissions.request` on a user gesture. Declare broad patterns only as **optional** host permissions where required. Avoid persistent `<all_urls>` permission.
- Register/unregister or inject content scripts based on current granted origins; reconcile on startup, permission changes, and site removal. Prevent duplicate listeners. Do not claim protection where Chrome restricts script injection.
- Prefer minimum permissions. Evaluate use of `activeTab` if it genuinely reduces requested surface; do not request extra capabilities by default.

### 4.2 Paste interception design

1. A content script listens in capture phase for paste events on authorized origins.
2. Verify it is a user paste to an editable target (`textarea`, supported text `input`, `contenteditable`, or tested rich-text adapter). Respect disabled/read-only fields and unsupported surfaces.
3. Read `text/plain` from the event's clipboard data without global clipboard permissions.
4. Run synchronous local scan. If clean, do nothing; browser handles paste normally.
5. If findings exist or scanning cannot complete safely, `preventDefault()` **synchronously** and display a warning in a Shadow DOM-isolated UI.
6. On Redacted/Original, use an editor-specific insertion adapter that respects selection, composition, change/input events, React-controlled editor semantics, and undo where feasible. Test behavior: do not assume `element.value = ...` will integrate correctly.
7. On Cancel/Escape/dismissal, insert nothing, preserve existing value and selection where feasible, and restore focus.
8. Guard against re-entrant paste handling; clean up observers and listeners when the script is disabled.

**Limitations:** Some sites use complex editors or inaccessible contexts. Explicitly label unsupported editors; do not silently claim protection. Cross-origin frames require separate permissions and testing. Do not intercept passwords as a generic content-editing feature.

### 4.3 Warning UI

- Redact is primary; Original is a conscious secondary action; Cancel is always available.
- Show detector category, severity, number of findings, and a *redacted* preview only.
- Avoid showing complete original secrets in tooltips, accessible labels, attributes, or DOM datasets.
- Support focus trap, Escape cancellation, keyboard access, screen readers, compact displays, and light/dark mode.
- Keep the original text transient in memory until the decision, then drop references promptly; do not claim guaranteed memory wiping in JavaScript.

## 5. Architecture

Use pnpm workspaces and isolate domain logic from browser integration:

```text
promptknight/
├── apps/
│   └── extension/
│       ├── entrypoints/
│       │   ├── background.ts
│       │   ├── content/index.ts
│       │   ├── popup/{index.html,main.tsx,App.tsx}
│       │   └── options/{index.html,main.tsx,App.tsx}
│       ├── src/
│       │   ├── components/
│       │   ├── hooks/
│       │   ├── site-adapters/
│       │   ├── storage/
│       │   ├── permissions/
│       │   └── paste/
│       ├── wxt.config.ts
│       └── package.json
├── packages/
│   ├── detection-engine/
│   │   ├── src/{detectors,scanner.ts,redactor.ts,types.ts,index.ts}
│   │   ├── tests/
│   │   └── package.json
│   └── shared/
│       ├── src/
│       └── package.json
├── tests/{integration,e2e,fixtures}/
├── docs/{architecture.md,threat-model.md,privacy.md,chrome-web-store.md}
├── .github/workflows/ci.yml
├── README.md
├── CONTRIBUTING.md
├── SECURITY.md
├── LICENSE
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
├── package.json
└── tsconfig.base.json
```

Names everywhere must be **PromptKnight** for the product, `promptknight` for directories and identifiers, and `@promptknight/*` for workspace packages. **Do not retain legacy product names or package scopes anywhere** (including docs, metadata, extension title, scripts, package names, screenshots, or release artifact filenames).

### Recommended stack

- React + TypeScript (strict)
- WXT with its supported React integration and Vite
- pnpm workspaces
- Vitest unit/integration tests
- Playwright for Chromium extension E2E tests with local fixture pages
- ESLint flat config + Prettier
- GitHub Actions for CI
- MIT license

Avoid premature state-management libraries; introduce one only if necessary.

## 6. Security and privacy requirements

Threats to document: accidental leaks through paste; malicious/sensitive text in clipboard; DOM injection/XSS; hostile host-page CSS/JS; extension permission overreach; stale registered content scripts; false positives/negatives; large payloads/regex DoS; logs and screenshot leaks; rich-text bypass; iframes; other paste pathways.

Required properties:

- No backend, analytics, telemetry, or runtime remote scripts in MVP.
- No network transmission of pasted text. Detect/test unexpected extension-origin requests.
- No persistent storage of clipboard text, findings containing raw values, or previews.
- Settings may be stored locally through extension storage.
- Avoid `innerHTML` for untrusted paste content; render plain text with React or text nodes.
- No real secrets in examples, fixtures, screenshot assets, documentation, or issue templates.
- Document that local-first does not mean infallible protection. Do not describe it as enterprise-grade DLP.
- Content scripts run only on explicitly authorized sites. Minimize host permissions and publish an accurate privacy policy.
- Define a vulnerability reporting process in `SECURITY.md` without inventing a contact address.

## 7. Testing strategy

### Unit — detection-engine

- No findings for ordinary text, including lookalike strings.
- Positive synthetic samples for each detector.
- Deterministic results and stable token numbering.
- Overlapping findings and invalid range handling.
- UTF-16 offset correctness with emoji/non-BMP characters.
- Multiline `.env`, JSON, pasted stack traces, URLs, escaped text, false-positive candidates.
- Long adversarial inputs and performance regression tests.
- Redact preserves delimiters and structural usefulness where possible.

### Integration — paste and DOM

- textarea, text input, contenteditable.
- Initial selection/caret restoration.
- Clean paste uses native behavior.
- Detected paste blocked pending choice.
- Redacted inserts only redacted text; Original inserts original only on explicit action; Cancel changes nothing.
- Escape/dismissal cancel.
- Repeated pastes, disable/enable, revoked permissions, unsupported editors, duplicate content script injection.
- Scan failure/oversized paste displays explicit warning, not silent allow.

### E2E — Playwright

- Load unpacked Chrome extension in Chromium.
- Exercise local fixture pages for vanilla textarea, React-controlled text input, and contenteditable.
- Test permission/onboarding flows where automation permits.
- Perform manual smoke tests in ChatGPT/Claude/Gemini and note date/version of test; third-party UI changes are expected.
- Verify build manifests request no unnecessary permissions and no remote code.

**Coverage target:** >=90% of the detection engine as an engineering goal, not a substitute for meaningful cases.

## 8. Implementation milestones

### M01 — Repository foundation (0.5–1 day)

Create monorepo and WXT React popup; placeholder background; public detection-engine interfaces with empty stub implementation; workspace exports; strict TS; ESLint/Prettier; Vitest starter tests; GitHub CI; MIT, README, CONTRIBUTING, SECURITY and draft architecture/threat model.

**Acceptance:** `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` pass in a clean environment; unpacked extension loads and popup renders “PromptKnight”; generated manifest has no unnecessary access. No actual paste handling yet.

### M02 — Detection engine (2–4 days)

Implement prioritized detectors, validators, scan result, overlap resolution, redaction and synthetic fixtures. Include false-positive and adversarial cases. Keep engine framework-independent.

**Acceptance:** all detector tests pass, deterministic redaction, no raw secrets in findings or logs, benchmark documented.

### M03 — Paste interception and warning UI (2–4 days)

Build capture-phase paste listener, supported editor detection, scan wiring, Shadow DOM UI, Redact/Original/Cancel, proper cleanup and insertion adapters.

**Acceptance:** local browser fixtures pass for textarea, React-controlled input and contenteditable; Cancel changes nothing, clean text pastes natively; unsupported scenarios are surfaced.

### M04 — Permissions, sites and settings (2–3 days)

Build ChatGPT/Claude/Gemini presets, custom HTTPS origin configuration, optional permission requests, dynamic content script registration, storage and enable/disable controls.

**Acceptance:** users can grant/revoke sites; listeners are registered only where approved; restart and permission revocation reconcile correctly; no silent broad-access request.

### M05 — Hardening and E2E (3–4 days)

Implement and run Playwright fixtures, error paths, accessibility tests, security audit, privacy checks, edge-case regression tests. Document precise coverage limitations.

**Acceptance:** critical flows pass in CI or clearly identified manual tests; no unexpected network transmissions or persistence of pasted text; README instructions verified.

### M06 — Public release (1–3 days)

Finalize documentation and assets, create `v1.0.0` tag and GitHub Release ZIP, prepare Chrome Web Store listing, privacy policy and permission justifications, then submit for review.

**Acceptance:** reproducible ZIP from build, store listing materials complete, submitted for review. Do not claim approved/public until actual approval.

## 9. GitHub Actions

Run on pushes to `main` and pull requests:

1. Install pinned pnpm and supported Node LTS.
2. `pnpm install --frozen-lockfile`.
3. `pnpm lint`.
4. `pnpm typecheck`.
5. `pnpm test`.
6. `pnpm build`.

Use minimal token permissions. Do not publish automatically in M01. Add release automation later only when credentials and approvals are configured securely.

## 10. Chrome Web Store release checklist

- Register developer account and meet current Chrome Web Store requirements.
- Build MV3 ZIP without remote executable code.
- Set name **PromptKnight**, version, description, icons, and accurate feature list.
- Provide screenshots and optional promotional images captured from actual release UI.
- Publish privacy policy explaining locally processed clipboard data and zero external transfer in MVP.
- Explain purpose and each permission requested, especially optional host access.
- Complete applicable privacy/data-use disclosures truthfully.
- Test in a clean Chrome profile with a minimal site permission set.
- Submit for review; review timing/approval are external and not guaranteed.

Verify current policy/docs near publication: https://developer.chrome.com/docs/webstore/ and https://developer.chrome.com/docs/extensions/ . WXT docs: https://wxt.dev/ .

## 11. Open-source strategy

- MIT licensed core and extension.
- Public roadmap, CHANGELOG, good-first-issue candidates, contribution guide, code of conduct if community warrants.
- README GIF demonstrating a **synthetic** token blocked and redacted.
- State limitations prominently; accept security reports privately where possible.
- Potential monetization **after demonstrated adoption**: optional team policy management or hosted reporting; do not remove previously free core features merely to upsell.

## 12. Instructions to Codex: first executable task

**Execute M01 only.** Do not implement later milestones in this run. Read this spec, inspect the working directory, and use supported current stable versions of WXT and its React integration. Initialize the monorepo exactly with the `PromptKnight` naming policy.

Detailed steps:

1. Create workspaces `apps/extension`, `packages/detection-engine`, `packages/shared`.
2. Set root scripts: `dev`, `build`, `typecheck`, `lint`, `format`, `format:check`, `test`, `test:coverage`.
3. Create MV3 WXT React popup displaying **PromptKnight**, “Local-first protection for sensitive text”, and “Development preview”. Add a no-op background entrypoint. Request no host access in M01.
4. Export the public detection types and a stub `scan(text): ScanResult` returning zero findings and `redact(text, []): string` returning unchanged text. Ensure no framework or Chrome dependencies in the engine.
5. Add meaningful starter Vitest tests for empty result, clean-text preservation, and package public import.
6. Configure TypeScript strict mode, ESLint flat config, React hooks rules, Prettier, pnpm lockfile and GitHub Actions checks.
7. Add README, MIT LICENSE (do not invent copyright holder; use a neutral acceptable copyright line or request the holder only if necessary), CONTRIBUTING, SECURITY, architecture and threat-model drafts.
8. Install, run all checks, build the extension, and inspect generated manifest. Fix failures.
9. Search the repository for legacy product naming and package scopes; none may remain.
10. Return a concise completion report: files changed, architectural decisions, actual command outcomes, generated extension location, manual loading steps, limitations, and proposed M02 scope.

**Stop after M01.** Do not implement detectors, content scripts, dynamic permissions, real paste interception, payment, backend, or store publication in this task.

## 13. Final MVP Definition of Done

- [ ] P0 requirements are implemented and verified.
- [ ] Permissions are opt-in and accurately scoped.
- [ ] Redact, Original and Cancel work for supported editors.
- [ ] Clean paste is unaffected.
- [ ] Failure and oversized-input handling never silently implies safety.
- [ ] Raw secret text never enters logs, network requests, persistent storage or exported reports.
- [ ] Unit, integration and E2E tests are passing (or manual exceptions explicitly recorded).
- [ ] CI checks pass.
- [ ] README, CONTRIBUTING, SECURITY, threat model and privacy policy are accurate.
- [ ] MIT license is present.
- [ ] Chrome Web Store ZIP, metadata and permissions disclosures are prepared.
- [ ] A public GitHub release exists.


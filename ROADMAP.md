# Roadmap

PromptKnight is a development preview. The detection engine and manual page paste checks are implemented. Browser fixture
acceptance remains unverified in the restricted implementation environment.

## Available

- Manifest V3 extension with manual page enable/disable from the popup.
- Paste interception, redacted warning and explicit Original/Redacted/Cancel choices.
- Local detection and deterministic redaction for seven secret categories.
- Synthetic unit tests, hostile-input cases and a scan benchmark.
- Strict TypeScript, formatting, linting and CI build checks.

## Planned

1. **Sites and permissions (M04):** per-origin opt-in access for AI-site presets and
   custom HTTPS sites; reconcile permissions and content scripts after changes.
2. **Hardening (M05):** browser fixtures, accessibility checks, editor compatibility,
   privacy checks and documented limitations.
3. **Public release (M06):** reproducible extension packages, user documentation,
   privacy policy, store assets and Chrome Web Store submission.

Optional follow-ups include category settings and more editor adapters. Cloud sync,
payments, continuous input monitoring and file scanning are outside the initial scope.

Detection remains heuristic. No release date or comprehensive data-loss prevention
guarantee is implied.

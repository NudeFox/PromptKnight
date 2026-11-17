# Roadmap

PromptKnight is a development preview. The standalone detection engine works; the
extension does not yet intercept or protect browser pastes.

## Available

- Manifest V3 extension shell with a React popup.
- Local detection and deterministic redaction for seven secret categories.
- Synthetic unit tests, hostile-input cases and a scan benchmark.
- Strict TypeScript, formatting, linting and CI build checks.

## Planned

1. **Paste interception and warning UI (M03):** capture trusted pastes in supported
   editors, show a redacted preview and offer Redact, Original or Cancel. Preserve
   selection and focus; require explicit decisions on scan failures or oversized input.
2. **Sites and permissions (M04):** per-origin opt-in access for AI-site presets and
   custom HTTPS sites; reconcile permissions and content scripts after changes.
3. **Hardening (M05):** browser fixtures, accessibility checks, editor compatibility,
   privacy checks and documented limitations.
4. **Public release (M06):** reproducible extension packages, user documentation,
   privacy policy, store assets and Chrome Web Store submission.

Optional follow-ups include category settings and more editor adapters. Cloud sync,
payments, continuous input monitoring and file scanning are outside the initial scope.

Detection remains heuristic. No release date or comprehensive data-loss prevention
guarantee is implied.

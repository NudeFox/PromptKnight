# Security policy

PromptKnight is an early development preview. The standalone engine detects and
redacts potential secrets locally. Manual page paste checks are implemented for basic
editors; browser fixture acceptance is still unverified in the implementation sandbox.
Detection is heuristic and can miss secrets or flag ordinary text.

Do not post live secrets, clipboard contents, or exploit details in public issues.
If the repository's GitHub Security tab offers **Report a vulnerability**, use its
private reporting flow. Otherwise ask the maintainers through a public issue for a
private reporting channel without including vulnerability details. No dedicated
contact address or response-time commitment has been established.

Provide affected revision, impact, and minimal reproduction using synthetic data
through an agreed private channel. If you accidentally expose credentials, revoke or
rotate them with their provider; removing an issue or log does not undo exposure.

For ordinary bugs, use a public issue with sanitized reproduction steps. Only the
current development version is maintained at this stage.

# Contributing to PromptKnight

Use Node.js 24 and the pinned pnpm version. Follow the setup and loading instructions
in the README. Keep changes scoped to a milestone from `PromptKnight_SPEC.md`.

Before submitting a pull request, run:

```sh
pnpm install --frozen-lockfile
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm test:coverage
pnpm build
```

Explain the behavior changed, validation performed, and remaining limitations.
Use only synthetic fixtures; never include real credentials, pasted content, or sensitive
screenshots in source, logs, issues, or pull requests. Keep the detection engine independent
of React, DOM, WXT, and browser APIs. Do not add access permissions without a concrete need.
Report security concerns according to SECURITY.md.

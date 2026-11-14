# M01 verification — 2026-11-02

Implemented repository foundation only. M02 has not started.

Environment: macOS, Node.js 24.14.0, pnpm 10.28.2, WXT 0.21.5,
`@wxt-dev/module-react` 1.2.2, Vite 8.3.5 (resolved versions in lockfile).

| Command or inspection                         | Result                                                                                                         |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile`              | Passed in workspace, including WXT preparation                                                                 |
| `pnpm lint`                                   | Passed                                                                                                         |
| `pnpm format:check`                           | Passed                                                                                                         |
| `pnpm typecheck`                              | Passed for all three workspaces                                                                                |
| `pnpm test`                                   | Passed: one file, six tests                                                                                    |
| `pnpm test:coverage`                          | Passed: 100% of the two stub functions; no claim about future detectors                                        |
| `pnpm build`                                  | Passed; production output is `apps/extension/.output/chrome-mv3`                                               |
| Production manifest                           | MV3; correct name/popup/background; no permissions, host permissions, optional permissions, or content scripts |
| Packaged popup                                | Required three strings and inactive-protection notice present; entrypoint files exist                          |
| Legacy product-name scan                      | No matches in source, docs, spec, configuration, or generated extension                                        |
| Unpacked browser loading and visual rendering | Unverified: browser automation timed out; headless attempt produced no usable session                          |

A fresh source copy without `node_modules`, `.wxt`, or `.output` also passed installation,
lint, typecheck, tests, and build. Its installation used
`pnpm install --frozen-lockfile --offline --store-dir <existing-package-cache>`.
The sandbox cannot resolve the npm registry from pnpm, so dependencies were initially
downloaded with approved curl access through temporary files outside the repository.
The normal frozen install subsequently passed without that temporary download bridge.
A network-enabled clean CI runner has not been observed in this task.

The browser smoke test remains an outstanding acceptance check, not a claimed pass.
Follow the README's Load unpacked steps and confirm the popup and extension error state.

The spec's two literal references to the forbidden legacy name were reworded to retain
the naming prohibition while allowing its own zero-match naming requirement to pass.

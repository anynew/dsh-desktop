# DeepSeek Harness Desktop

This reference covers the Electron application in this directory. It embeds the shared Web GUI and runs the Harness Host in Electron's main process without opening an HTTP or WebSocket listening socket.

## Development

Install and build from the repository root, then launch the desktop application:

```sh
pnpm install
pnpm --filter @deepseek-ai/dsh-desktop build
pnpm --filter @deepseek-ai/dsh-desktop dev
```

The renderer uses a sandboxed CommonJS preload and a narrow typed IPC bridge. Node integration remains disabled. The `dsh-app://app/` protocol serves the shell and dynamic client bundles with a strict Content Security Policy.

On macOS, drag the window from the 12-pixel strip at its very top. The application title, tabs, and toolbar below remain available for their normal actions.

## Packaging

Build an unpacked application for the current platform and run the packaged smoke test:

```sh
pnpm --filter @deepseek-ai/dsh-desktop run pack
pnpm --filter @deepseek-ai/dsh-desktop run smoke:packaged
```

The smoke test starts the electron-builder output with isolated application state and requires the preload bridge, absence of renderer Node globals, and rendered GUI content.

## Release

The `desktop-release` GitHub Actions workflow accepts an existing annotated `dsh-v*` tag whose version matches this package. The `desktop-production` environment controls final publication approval.

A production release requires:

- macOS Developer ID signing, hardened runtime, notarization, stapling, and Gatekeeper assessment;
- Windows Authenticode signing of the application and NSIS installer;
- packaged application smoke tests on each build runner;
- updater metadata whose version, file sizes, and SHA-512 values match the payloads;
- CycloneDX SBOM, SHA-256 manifest, and GitHub build provenance;
- a post-upload download check against the SHA-256 release manifest.

Required repository secrets are `DESKTOP_CSC_LINK`, `DESKTOP_CSC_KEY_PASSWORD`, `DESKTOP_WIN_CSC_LINK`, `DESKTOP_WIN_CSC_KEY_PASSWORD`, `DESKTOP_APPLE_ID`, `DESKTOP_APP_SPECIFIC_PASSWORD`, and `DESKTOP_APPLE_TEAM_ID`. Store signing certificates as encrypted CI secrets; never commit them.

The updater downloads signed GitHub Release artifacts, refuses downgrades, prompts before an immediate restart, and installs a downloaded update on normal exit when the user defers. Set `DSH_DESKTOP_DISABLE_UPDATES=1` only for controlled smoke or recovery runs.

## Runtime diagnostics

Main-process failures, updater failures, unhandled rejections, and renderer exits are written through `electron-log`. Electron also stores native crash dumps locally without uploading them. The renderer automatically reloads at most twice within one minute; a third crash stops automatic reload to prevent an infinite recovery loop.

## Known limitations and deferred work

Release success depends on externally managed Apple and Windows signing identities and the `desktop-production` GitHub environment. Those credentials cannot be validated from an unsigned local build; the release workflow fails before publication when signing, notarization, stapling, Authenticode, packaged startup, or remote artifact verification fails.

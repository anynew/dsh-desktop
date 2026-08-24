# dsh-client-ui-desktop-about

English | [中文](README.zh.md)

Desktop-only Settings About page. Electron injects the immutable client version and upstream baseline before renderer boot; the page performs no API or network request. Its two HTTPS links use normal safe new-window anchors, so Electron opens them in the system browser.

## Model Experience

None.

## Known Limitations and Deferred Work

The upstream baseline is build metadata and must be updated when the desktop branch syncs upstream.

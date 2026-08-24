# Agent Note: desktop About settings build metadata

Status: implemented

English | [中文](2026-08-24-desktop-about-settings.zh.md)

## Problem

The packaged desktop client needs a local About page that identifies its Electron version and the upstream release it is based on without making a network request or exposing this desktop-specific information in the Web application.

## Decision

`@deepseek-ai/dsh-client-ui-desktop-about` registers the `about` Settings section at order 30, after Agent presets, only through the desktop Host patch. The desktop protocol injects the Electron package version and the fixed `DESKTOP_UPSTREAM_BASE_TAG` global before renderer boot. The page validates that data once, renders it read-only, and uses `target="_blank" rel="noopener noreferrer"` links to the official release and tag pages. Electron's existing window policy opens HTTPS links in the system browser.

## Alternatives considered

Making the page a shared settings plugin would expose desktop build details on Web. Fetching GitHub at page load would make the page dependent on network availability and change the reported baseline after release. A privileged IPC link opener would duplicate the existing safe external-window policy.

## Consequences

The desktop build metadata is visible locally and deterministic. Upstream synchronization must update `DESKTOP_UPSTREAM_BASE_TAG` when its base tag changes. The protocol and component tests cover injected fields, section composition, and safe official links.

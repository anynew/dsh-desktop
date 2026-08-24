# Agent Note: 桌面端关于页构建元数据

Status: implemented

[English](2026-08-24-desktop-about-settings.md) | 中文

## Problem

打包后的桌面客户端需要一个本地“关于”页，在不请求网络、不把桌面专属信息暴露到 Web 应用的前提下，显示 Electron 版本和所基于的上游版本。

## Decision

`@deepseek-ai/dsh-client-ui-desktop-about` 仅通过桌面 Host 补丁注册顺序为 30 的 `about` 设置页，位于 Agent 预设之后。桌面协议在渲染器启动前注入 Electron 包版本和固定的 `DESKTOP_UPSTREAM_BASE_TAG` 全局数据。页面只读显示并在启动时校验数据，使用 `target="_blank" rel="noopener noreferrer"` 链接到官方 Release 和标签页。Electron 既有窗口策略会在系统浏览器打开 HTTPS 链接。

## Alternatives considered

共享设置插件会让 Web 也显示桌面构建信息。页面加载时请求 GitHub 会依赖网络，并可能在发布后改变所显示的基线。特权 IPC 打开链接会重复既有的安全外部窗口策略。

## Consequences

桌面构建元数据可在本地稳定显示。上游同步变更基线标签时必须更新 `DESKTOP_UPSTREAM_BASE_TAG`。协议和组件测试覆盖注入字段、设置页组合与安全的官方链接。

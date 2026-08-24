# dsh-client-ui-desktop-about

[English](README.md) | 中文

仅桌面端的设置“关于”页。Electron 在渲染器启动前注入只读客户端版本和上游基线；页面不会请求 API 或网络。两个 HTTPS 链接使用安全的新窗口锚点，Electron 会在系统浏览器中打开。

## Model Experience

无。

## Known Limitations and Deferred Work

上游基线属于构建元数据，桌面分支同步上游时必须更新。

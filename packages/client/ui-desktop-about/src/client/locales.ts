/** English copy for the desktop-only About page. */
export const zh = {
  nav: '关于',
  clientVersion: '客户端版本',
  upstreamBase: '上游基线',
  viewRelease: '查看此上游版本',
  viewTags: '查看全部上游标签',
} satisfies Record<string, string>

/** Translation keys owned by this page. */
export type DesktopAboutKey = keyof typeof zh

/** Chinese copy for the desktop-only About page. */
export const en = {
  nav: 'About',
  clientVersion: 'Client version',
  upstreamBase: 'Upstream baseline',
  viewRelease: 'View this upstream release',
  viewTags: 'View all upstream tags',
} satisfies Record<DesktopAboutKey, string>

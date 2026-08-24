/** Shell chrome and General-nav dictionaries; feature rows own their copy. */

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'trigger': '设置',
  'title': '设置',
  'close': '关闭',
  'openDocument': '打开配置文件',
  'openDocument.error': '无法打开配置文件',
  'general.nav': '通用设置',
  'about.nav': '关于',
  'about.clientVersion': '客户端版本',
  'about.upstreamBase': '上游基线',
  'about.release': '查看此上游版本',
  'about.tags': '查看全部上游标签',
} satisfies Record<string, string>

/** The settings namespace key union. */
export type SettingsKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'trigger': 'Settings',
  'title': 'Settings',
  'close': 'Close',
  'openDocument': 'Open configuration file',
  'openDocument.error': 'Could not open configuration file',
  'general.nav': 'General',
  'about.nav': 'About',
  'about.clientVersion': 'Client version',
  'about.upstreamBase': 'Upstream baseline',
  'about.release': 'View this upstream release',
  'about.tags': 'View all upstream tags',
} satisfies Record<SettingsKey, string>

import type { ReactNode } from 'react'
import type { DesktopAboutBuild } from '../index.ts'
import type { en } from './locales.ts'
import styles from './AboutSection.module.css'

const UPSTREAM_REPOSITORY = 'https://github.com/deepseek-ai/deepseek-harness'

/** Dependencies supplied by the desktop About plugin registration. */
export interface AboutSectionInjected {
  /** Immutable Electron build data. */
  about: DesktopAboutBuild
  /** Localized section copy. */
  t: (key: keyof typeof en) => string
}

/** Render fixed build details and system-browser links for the desktop app. */
export function AboutSection({ about, t }: AboutSectionInjected): ReactNode {
  const releaseUrl = `${UPSTREAM_REPOSITORY}/releases/tag/${encodeURIComponent(about.upstreamBaseTag)}`
  return <section className={styles.section} aria-label={t('nav')}>
    <h2 className={styles.title}>DeepSeek Harness</h2>
    <dl className={styles.details}>
      <div><dt>{t('clientVersion')}</dt><dd>{about.clientVersion}</dd></div>
      <div><dt>{t('upstreamBase')}</dt><dd>{about.upstreamBaseTag}</dd></div>
    </dl>
    <div className={styles.links}>
      <a href={releaseUrl} target="_blank" rel="noopener noreferrer">{t('viewRelease')}</a>
      <a href={`${UPSTREAM_REPOSITORY}/tags`} target="_blank" rel="noopener noreferrer">{t('viewTags')}</a>
    </div>
  </section>
}

import type { ReactNode } from 'react'
import styles from './DesktopAboutSection.module.css'

const REPOSITORY = 'https://github.com/deepseek-ai/deepseek-harness'

/** Immutable fields injected only by Electron's desktop protocol. */
interface DesktopAboutBuild {
  readonly clientVersion: string
  readonly upstreamBaseTag: string
}

/** Return desktop build fields when this renderer is served by Electron. */
export function desktopAboutBuild(): DesktopAboutBuild | undefined {
  const value = (globalThis as Record<string, unknown>).__DSH_DESKTOP_ABOUT__
  if (typeof value !== 'object' || value === null) return undefined
  const fields = value as Record<string, unknown>
  if (typeof fields.clientVersion !== 'string' || typeof fields.upstreamBaseTag !== 'string') return undefined
  return { clientVersion: fields.clientVersion, upstreamBaseTag: fields.upstreamBaseTag }
}

/** Render Electron build metadata and safe official external links. */
export function DesktopAboutSection({ about, t }: {
  about: DesktopAboutBuild
  t: (key: 'about.nav' | 'about.clientVersion' | 'about.upstreamBase' | 'about.release' | 'about.tags') => string
}): ReactNode {
  const release = `${REPOSITORY}/releases/tag/${encodeURIComponent(about.upstreamBaseTag)}`
  return <section className={styles.section} aria-label={t('about.nav')}>
    <h2>DeepSeek Harness</h2>
    <dl><div><dt>{t('about.clientVersion')}</dt><dd>{about.clientVersion}</dd></div><div><dt>{t('about.upstreamBase')}</dt><dd>{about.upstreamBaseTag}</dd></div></dl>
    <p><a href={release} target="_blank" rel="noopener noreferrer">{t('about.release')}</a><a href={`${REPOSITORY}/tags`} target="_blank" rel="noopener noreferrer">{t('about.tags')}</a></p>
  </section>
}

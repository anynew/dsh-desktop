// @vitest-environment jsdom
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { AboutSection } from '../src/client/AboutSection.tsx'

describe('desktop About settings section', () => {
  it('renders fixed build details and safe official links', () => {
    render(<AboutSection about={{ clientVersion: '0.1.0-rc.8', upstreamBaseTag: 'dsh-v0.1.1-rc.2' }} t={key => ({
      nav: 'About', clientVersion: 'Client version', upstreamBase: 'Upstream baseline',
      viewRelease: 'View this upstream release', viewTags: 'View all upstream tags',
    })[key]} />)

    expect(screen.getByText('0.1.0-rc.8')).toBeTruthy()
    expect(screen.getByText('dsh-v0.1.1-rc.2')).toBeTruthy()
    const release = screen.getByRole('link', { name: 'View this upstream release' })
    expect(release.getAttribute('href')).toBe('https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.1-rc.2')
    expect(release.getAttribute('target')).toBe('_blank')
    expect(release.getAttribute('rel')).toBe('noopener noreferrer')
    expect(screen.getByRole('link', { name: 'View all upstream tags' }).getAttribute('href')).toBe(
      'https://github.com/deepseek-ai/deepseek-harness/tags',
    )
  })
})

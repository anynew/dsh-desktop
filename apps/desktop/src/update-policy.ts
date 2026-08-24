/** Version acceptance policy for desktop updates and recovery releases. */

const VERSION_PATTERN = /^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/

interface Version {
  major: number
  minor: number
  patch: number
  prerelease?: string
}

/**
 * Determine whether a published version is a forward update for the running application.
 * @param currentVersion - installed application version.
 * @param candidateVersion - version declared by update metadata.
 * @returns `true` only for a strictly newer valid semantic version.
 */
export function acceptsDesktopUpdate(currentVersion: string, candidateVersion: string): boolean {
  const current = parseVersion(currentVersion)
  const candidate = parseVersion(candidateVersion)
  if (current === undefined || candidate === undefined) return false
  const core = compareCore(candidate, current)
  if (core !== 0) return core > 0
  if (current.prerelease === undefined) return false
  if (candidate.prerelease === undefined) return true
  return comparePrerelease(candidate.prerelease, current.prerelease) > 0
}

function parseVersion(value: string): Version | undefined {
  const match = VERSION_PATTERN.exec(value)
  if (match === null) return undefined
  const [, major, minor, patch, prerelease] = match
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    ...(prerelease === undefined ? {} : { prerelease }),
  }
}

function compareCore(left: Version, right: Version): number {
  return left.major - right.major || left.minor - right.minor || left.patch - right.patch
}

function comparePrerelease(left: string, right: string): number {
  const leftParts = left.split('.')
  const rightParts = right.split('.')
  for (let index = 0; index < Math.max(leftParts.length, rightParts.length); index += 1) {
    const leftPart = leftParts[index]
    const rightPart = rightParts[index]
    if (leftPart === undefined) return -1
    if (rightPart === undefined) return 1
    if (leftPart === rightPart) continue
    const leftNumber = /^\d+$/.test(leftPart) ? Number(leftPart) : undefined
    const rightNumber = /^\d+$/.test(rightPart) ? Number(rightPart) : undefined
    if (leftNumber !== undefined && rightNumber !== undefined) return leftNumber - rightNumber
    if (leftNumber !== undefined) return -1
    if (rightNumber !== undefined) return 1
    return leftPart.localeCompare(rightPart)
  }
  return 0
}

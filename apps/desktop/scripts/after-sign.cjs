const { execFileSync } = require('node:child_process')
const { notarize } = require('@electron/notarize')

exports.default = async function afterSign(context) {
  if (process.platform !== 'darwin') return
  const appleId = process.env.APPLE_ID
  const appleIdPassword = process.env.APPLE_APP_SPECIFIC_PASSWORD
  const teamId = process.env.APPLE_TEAM_ID
  if (!appleId || !appleIdPassword || !teamId) {
    if (process.env.CSC_IDENTITY_AUTO_DISCOVERY === 'false') return
    throw new Error('desktop release: APPLE_ID, APPLE_APP_SPECIFIC_PASSWORD, and APPLE_TEAM_ID are required for notarization')
  }
  const appPath = `${context.appOutDir}/${context.packager.appInfo.productFilename}.app`
  await notarize({
    appPath,
    appleId,
    appleIdPassword,
    teamId,
  })
  execFileSync('xcrun', ['stapler', 'staple', appPath], { stdio: 'inherit' })
  execFileSync('xcrun', ['stapler', 'validate', appPath], { stdio: 'inherit' })
}

const required = process.platform === 'darwin'
  ? ['CSC_LINK', 'CSC_KEY_PASSWORD', 'APPLE_ID', 'APPLE_APP_SPECIFIC_PASSWORD', 'APPLE_TEAM_ID']
  : process.platform === 'win32'
    ? ['WIN_CSC_LINK', 'WIN_CSC_KEY_PASSWORD']
    : []
if (required.length === 0) throw new Error(`desktop signing environment: unsupported platform ${process.platform}`)
const missing = required.filter(name => !process.env[name])
if (missing.length > 0) throw new Error(`desktop signing environment: missing ${missing.join(', ')}`)
console.log(`desktop signing environment verified for ${process.platform}`)

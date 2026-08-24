'use strict'

const { flipFuses, FuseVersion, FuseV1Options } = require('@electron/fuses')

/** Harden the packaged Electron executable before platform signing. */
module.exports = async function afterPack(context) {
  const executable = context.electronPlatformName === 'darwin'
    ? `${context.appOutDir}/${context.packager.appInfo.productFilename}.app/Contents/MacOS/${context.packager.appInfo.productFilename}`
    : `${context.appOutDir}/${context.packager.appInfo.productFilename}.exe`
  await flipFuses(executable, {
    version: FuseVersion.V1,
    resetAdHocDarwinSignature: true,
    strictlyRequireAllFuses: true,
    [FuseV1Options.RunAsNode]: false,
    [FuseV1Options.EnableCookieEncryption]: true,
    [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
    [FuseV1Options.EnableNodeCliInspectArguments]: false,
    [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
    [FuseV1Options.OnlyLoadAppFromAsar]: true,
    [FuseV1Options.LoadBrowserProcessSpecificV8Snapshot]: false,
    [FuseV1Options.GrantFileProtocolExtraPrivileges]: false,
    [FuseV1Options.WasmTrapHandlers]: true,
  })
}

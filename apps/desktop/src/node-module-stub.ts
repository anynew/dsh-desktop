/** Browser implementation of Loader's Node-only module resolver hook. */

export function createRequire(): (specifier: string) => never {
  return (specifier: string): never => {
    throw new Error(`desktop renderer cannot synchronously require ${JSON.stringify(specifier)}`)
  }
}

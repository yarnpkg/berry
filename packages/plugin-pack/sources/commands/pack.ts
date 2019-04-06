import {PluginConfiguration} from '@berry/core';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`pack [--filename]`)
  .describe(`Creates a compressed gzip archive of package dependencies.`)

  .detail(`
    This command will create a new compressed gzip archive of package dependencies in your local directory.

    \`--filename\` parameter names the archive of package as given filename.
  `)

  .example(
    `Creates a compressed gzip archive of the package dependencies.`,
    `yarn pack`,
  )

  .example(
    `Creates a compressed gzip archive of package dependencies with the given filename.`,
    `yarn pack --filename`,
  )

  .action(() => {
  })

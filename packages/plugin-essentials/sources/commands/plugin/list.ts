import {Configuration, MessageName, PluginConfiguration, StreamReport} from '@berry/core';
import {Clipanion}                                                     from 'clipanion';
import {Writable}                                                      from 'stream';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: Clipanion, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`plugin list`)
  .alias(`plugins list`)
  .describe(`list the active plugins`)

  .detail(`
    This command prints the currently active plugins. Will be displayed both builtin plugins and external plugins.
  `)

  .example(
    `List the currently active plugins`,
    `yarn plugin list`,
  )

  .action(async ({cwd, stdout}: {cwd: string, stdout: Writable}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);

    const report = await StreamReport.start({configuration, stdout}, async report => {
      for (const name of configuration.plugins.keys()) {
        if (pluginConfiguration.plugins.has(name)) {
          report.reportInfo(MessageName.UNNAMED, `${name} [builtin]`);
        } else {
          report.reportInfo(MessageName.UNNAMED, `${name}`);
        }
      }
    });

    return report.exitCode();
  });

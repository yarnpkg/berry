import {Configuration, PluginConfiguration} from '@berry/core';
import {UsageError}                         from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`config set <name> <value>`)
  .describe(`change a configuration settings`)

  .action(async ({cwd, name, value}: {cwd: string, name: string, value: string}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    if (!configuration.projectCwd)
      throw new UsageError(`This command must be run from within a project folder`);

    const settings = configuration.settings.get(name);
    if (!settings)
      throw new UsageError(`Couldn't find a configuration settings named "${name}"`);
    
    await Configuration.updateConfiguration(configuration.projectCwd, {
      [name]: value,
    });
  });

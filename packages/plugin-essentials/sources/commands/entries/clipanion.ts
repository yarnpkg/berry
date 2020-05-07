import {CommandContext, Configuration} from '@yarnpkg/core';
import {Command, Cli}                  from 'clipanion';

type ClipanionDefinition = ReturnType<Cli['definitions']>[number];
type ExtendedDefinition = ClipanionDefinition & {
  plugin: {
    name: string,
    isDefault: boolean,
  },
};

// eslint-disable-next-line arca/no-default-export
export default class ClipanionCommand extends Command<CommandContext> {
  @Command.Path(`--clipanion=definitions`)
  async execute() {
    const {plugins} = await Configuration.find(this.context.cwd, this.context.plugins);

    const pluginDefinitions: Array<[string, Array<ClipanionDefinition>]>  = [];
    for (const plugin of plugins) {
      const {commands} = plugin[1];
      if (commands) {
        const cli = Cli.from(commands);
        const definitions = cli.definitions();
        pluginDefinitions.push([plugin[0], definitions]);
      }
    }

    const clipanionDefinitions = this.cli.definitions() as Array<ExtendedDefinition>;

    const arePathsEqual = (path1: string, path2: string) =>
      path1.split(` `).slice(1).join() === path2.split(` `).slice(1).join();

    const defaultPlugins: Array<string> = require(`@yarnpkg/cli/package.json`)[`@yarnpkg/builder`].bundles.standard;

    for (const pluginDefinition of pluginDefinitions) {
      const definitions = pluginDefinition[1];

      for (const definition of definitions) {
        clipanionDefinitions
          .find(clipanionDefinition => arePathsEqual(clipanionDefinition.path, definition.path))!
          .plugin = {
            name: pluginDefinition[0],
            isDefault: defaultPlugins.includes(pluginDefinition[0]),
          };
      }
    }

    this.context.stdout.write(`${JSON.stringify({
      commands: clipanionDefinitions,
    }, null, 2)}\n`);
  }
}

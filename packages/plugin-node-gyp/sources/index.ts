import {Hooks as CoreHooks, Plugin, Project, SettingsType} from '@berry/core';

async function setupScriptEnvironment(project: Project, env: {[key: string]: string}, makePathWrapper: (name: string, argv0: string, args: Array<string>) => Promise<void>) {
  await makePathWrapper(`node-gyp`, process.execPath, [process.argv[1], `dlx`, `-q`, project.configuration.get(`nodeGypMagicLocator`)]);
}

const plugin: Plugin = {
  hooks: {
    setupScriptEnvironment,
  } as (
    CoreHooks
  ),
  configuration: {
    nodeGypMagicLocator: {
      description: `Package to use when node-gyp is omitted from the dependencies`,
      type: SettingsType.LOCATOR_LOOSE,
      default: `node-gyp`,
    },
  },
};

// eslint-disable-next-line arca/no-default-export
export default plugin;

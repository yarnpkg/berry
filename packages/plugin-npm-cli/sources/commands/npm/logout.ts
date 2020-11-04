import {BaseCommand}                                        from '@yarnpkg/cli';
import {Configuration, MessageName, miscUtils, structUtils} from '@yarnpkg/core';
import {StreamReport}                                       from '@yarnpkg/core';
import {npmConfigUtils}                                     from '@yarnpkg/plugin-npm';
import {Command, Usage}                                     from 'clipanion';

import {getRegistry}                                        from './login';

const LOGOUT_KEYS = new Set([
  `npmAuthIdent`,
  `npmAuthToken`,
]);

// eslint-disable-next-line arca/no-default-export
export default class NpmLogoutCommand extends BaseCommand {
  @Command.String(`-s,--scope`, {description: `Logout of the registry configured for a given scope`})
  scope?: string;

  @Command.Boolean(`--publish`, {description: `Logout of the publish registry`})
  publish: boolean = false;

  @Command.Boolean(`-A,--all`, {description: `Logout of all registries`})
  all: boolean = false;

  static usage: Usage = Command.Usage({
    category: `Npm-related commands`,
    description: `logout of the npm registry`,
    details: `
      This command will log you out by modifying your local configuration (in your home folder, never in the project itself) to delete all credentials linked to a registry.

      Adding the \`-s,--scope\` flag will cause the deletion to be done against whatever registry is configured for the associated scope (see also \`npmScopes\`).

      Adding the \`--publish\` flag will cause the deletion to be done against the registry used when publishing the package (see also \`publishConfig.registry\` and \`npmPublishRegistry\`).

      Adding the \`-A,--all\` flag will cause the deletion to be done against all registries and scopes.
    `,
    examples: [[
      `Logout of the default registry`,
      `yarn npm logout`,
    ], [
      `Logout of the @my-scope scope`,
      `yarn npm logout --scope my-scope`,
    ], [
      `Logout of the publish registry for the current package`,
      `yarn npm logout --publish`,
    ], [
      `Logout of all registries`,
      `yarn npm logout --all`,
    ]],
  });

  @Command.Path(`npm`, `logout`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    const checkLogout = async () => {
      const registry: string | null = await getRegistry({
        configuration,
        cwd: this.context.cwd,
        publish: this.publish,
        scope: this.scope,
      });

      const refreshedConfiguration = await Configuration.find(this.context.cwd, this.context.plugins);
      const fakeIdent = structUtils.makeIdent(this.scope ?? null, `pkg`);

      const authConfiguration = npmConfigUtils.getAuthConfiguration(registry, {
        configuration: refreshedConfiguration,
        ident: fakeIdent,
      });

      return !authConfiguration.get(`npmAuthToken`);
    };

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      if (this.all) {
        await logoutFromEverything();
        report.reportInfo(MessageName.UNNAMED, `Successfully logged out from everything`);
      }

      if (this.scope) {
        await logoutFrom(`npmScopes`, this.scope);

        if (await checkLogout())
          report.reportInfo(MessageName.UNNAMED, `Successfully logged out from ${this.scope}`);
        else
          report.reportWarning(MessageName.UNNAMED, `Scope authentication settings removed, but some other ones settings still apply to it`);

        return;
      }

      const registry: string | null = await getRegistry({
        configuration,
        cwd: this.context.cwd,
        publish: this.publish,
      });

      await logoutFrom(`npmRegistries`, registry);

      if (await checkLogout()) {
        report.reportInfo(MessageName.UNNAMED, `Successfully logged out from ${registry}`);
      } else {
        report.reportWarning(MessageName.UNNAMED, `Registry authentication settings removed, but some other ones settings still apply to it`);
      }
    });

    return report.exitCode();
  }
}

function removeTokenFromStore(nextStore: {[key: string]: unknown}, entryName: string) {
  const entry = nextStore[entryName];
  if (!miscUtils.isIndexableObject(entry))
    return false;

  const keys = new Set(Object.keys(entry));
  if ([...LOGOUT_KEYS].every(key => !keys.has(key)))
    return false;

  for (const key of LOGOUT_KEYS)
    keys.delete(key);

  if (keys.size === 0) {
    nextStore[entryName] = undefined;
    return true;
  }

  const nextEntry = {...entry};
  for (const key of LOGOUT_KEYS)
    delete nextEntry[key];

  nextStore[entryName] = nextEntry;

  return true;
}

async function logoutFromEverything() {
  const updater = (unknownStore: unknown) => {
    let updated = false;

    const nextStore = miscUtils.isIndexableObject(unknownStore)
      ? {...unknownStore}
      : {};

    if (nextStore.npmAuthToken) {
      delete nextStore.npmAuthToken;
      updated = true;
    }

    for (const entryName of Object.keys(nextStore))
      if (removeTokenFromStore(nextStore, entryName))
        updated = true;

    if (Object.keys(nextStore).length === 0)
      return undefined;

    if (updated) {
      return nextStore;
    } else {
      return unknownStore;
    }
  };

  return await Configuration.updateHomeConfiguration({
    npmRegistries: updater,
    npmScopes: updater,
  });
}

async function logoutFrom(entryType: `npmRegistries` | `npmScopes`, entryName: string) {
  return await Configuration.updateHomeConfiguration({
    [entryType]: (unknownStore: unknown) => {
      const nextStore = miscUtils.isIndexableObject(unknownStore)
        ? unknownStore
        : {};

      if (!Object.prototype.hasOwnProperty.call(nextStore, entryName))
        return unknownStore;

      const unknownEntry = nextStore[entryName];
      const nextEntry = miscUtils.isIndexableObject(unknownEntry)
        ? unknownEntry
        : {};

      const keys = new Set(Object.keys(nextEntry));
      if ([...LOGOUT_KEYS].every(key => !keys.has(key)))
        return unknownStore;

      for (const key of LOGOUT_KEYS)
        keys.delete(key);

      if (keys.size === 0) {
        if (Object.keys(nextStore).length === 1)
          return undefined;

        return {
          ...nextStore,
          [entryName]: undefined,
        };
      }

      const eraser: {[key: string]: undefined} = {};
      for (const key of LOGOUT_KEYS)
        eraser[key] = undefined;

      return {
        ...nextStore,
        [entryName]: {
          ...nextEntry,
          ...eraser,
        },
      };
    },
  });
}

import {BaseCommand}                from '@yarnpkg/cli';
import {Configuration, MessageName} from '@yarnpkg/core';
import {StreamReport}               from '@yarnpkg/core';
import {Command, Usage}             from 'clipanion';

import {getRegistry}                from './login';

// eslint-disable-next-line arca/no-default-export
export default class NpmLogoutCommand extends BaseCommand {
  @Command.String(`-s,--scope`)
  scope?: string;

  @Command.Boolean(`--publish`)
  publish: boolean = false;

  @Command.Boolean(`-A,--all`)
  all: boolean = false;

  static usage: Usage = Command.Usage({
    category: `Npm-related commands`,
    description: `logout of the npm registry`,
    details: `
      This command will log you out by modifying your local configuration (in your home folder, never in the project itself) to delete all credentials linked to a registry.

      Adding the \`-s,--scope\` flag will cause the deletion to be done against whatever registry is configured for the associated scope (see also \`npmScopes\`).

      Adding the \`--publish\` flag will cause the deletion to be done against the registry used when publishing the package (see also \`publishConfig.registry\` and \`npmPublishRegistry\`).

      Adding the \`-A,--all\` flag will cause the deletion to be done against all registries.
    `,
    examples: [[
      `Logout of the default registry`,
      `yarn npm logout`,
    ], [
      `Logout of the registry linked to the @my-scope registry`,
      `yarn npm logout --scope my-scope`,
    ], [
      `Logout of the publish registry for the current package`,
      `yarn npm logout --publish`,
    ], [
      `Logout of the publish registry for the current package linked to the @my-scope registry`,
      `yarn npm logout --publish --scope my-scope`,
    ], [
      `Logout of all registries`,
      `yarn npm logout --all`,
    ]],
  });

  @Command.Path(`npm`, `logout`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    const registry: string | null = this.all
      ? null
      : await getRegistry({
        configuration,
        cwd: this.context.cwd,
        publish: this.publish,
        scope: this.scope,
      });

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      await logout(registry);
      return report.reportInfo(MessageName.UNNAMED, `Successfully logged out of ${
        registry === null ? `all registries` : registry
      }`);
    });

    return report.exitCode();
  }
}

async function logout(registry: string | null) {
  return await Configuration.updateHomeConfiguration({
    npmRegistries: (registries: {[key: string]: any} = {}) => (
      registry === null
        ? undefined
        : {
          ...registries,
          [registry]: undefined,
        }
    ),
  });
}

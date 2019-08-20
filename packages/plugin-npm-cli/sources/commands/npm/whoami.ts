import {openWorkspace}                              from '@berry/cli';
import {Configuration, CommandContext, MessageName} from '@berry/core';
import {StreamReport}                               from '@berry/core';
import {npmConfigUtils, npmHttpUtils}               from '@berry/plugin-npm';
import {Command}                                    from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class NpmWhoamiCommand extends Command<CommandContext> {
  @Command.String(`-s,--scope`)
  scope?: string;

  @Command.Boolean(`--publish`)
  publish: boolean = false;

  static usage = Command.Usage({
    category: `Npm-related commands`,
    description: `display the name of the authenticated user`,
    details: `
      Print the username associated with the current authentication settings to the standard output.

      When using \`-s,--scope\`, the username printed will be the one that matches the authentication settings of the registry associated with the given scope (those settings can be overriden using the \`npmRegistries\` map, and the registry associated with the scope is configured via the \`npmScopes\` map).

      When using \`--publish\`, the registry we'll select will by default be the one used when publishing packages (\`publishConfig.registry\` or \`npmPublishRegistry\` if available, otherwise we'll fallback to the regular \`npmRegistryServer\`).
    `,
    examples: [[
      `Print username for the default registry`,
      `yarn npm whoami`,
    ], [
      `Print username for the registry on a given scope`,
      `yarn npm whoami --scope company`,
    ]],
  });

  @Command.Path(`npm`, `whoami`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    let registry: string;
    if (this.scope && this.publish)
      registry = npmConfigUtils.getScopeRegistry(this.scope, {configuration, type: npmConfigUtils.RegistryType.PUBLISH_REGISTRY});
    else if (this.scope)
      registry = npmConfigUtils.getScopeRegistry(this.scope, {configuration});
    else if (this.publish)
      registry = npmConfigUtils.getPublishRegistry((await openWorkspace(configuration, this.context.cwd)).manifest, {configuration});
    else
      registry = npmConfigUtils.getDefaultRegistry({configuration});

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      try {
        const response = await npmHttpUtils.get(`/-/whoami`, {
          configuration,
          registry,
          authType: npmHttpUtils.AuthType.ALWAYS_AUTH,
          json: true,
        });

        report.reportInfo(MessageName.UNNAMED, response.username);
      } catch (err) {
        if (err.statusCode === 401 || err.statusCode === 403) {
          report.reportError(MessageName.AUTHENTICATION_INVALID, `Authentication failed - your credentials may have expired`);
        } else {
          report.reportError(MessageName.AUTHENTICATION_INVALID, err.toString());
        }
      }
    });

    return report.exitCode();
  }
}

import {openWorkspace}                     from '@berry/cli';
import {Configuration, MessageName}        from '@berry/core';
import {PluginConfiguration, StreamReport} from '@berry/core';
import {PortablePath}                      from '@berry/fslib';
import {npmConfigUtils, npmHttpUtils}      from '@berry/plugin-npm';
import {Clipanion}                         from 'clipanion';
import {Readable, Writable}                from 'stream';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: Clipanion, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`npm whoami [-s,--scope SCOPE] [--publish]`)
  .categorize(`Npm-related commands`)
  .describe(`display the name of the authenticated user`)

  .detail(`
    Print the username associated with the current authentication settings to the standard output.

    When using \`-s,--scope\`, the username printed will be the one that matches the authentication settings of the registry associated with the given scope (those settings can be overriden using the \`npmRegistries\` map, and the registry associated with the scope is configured via the \`npmScopes\` map).

    When using \`--publish\`, the registry we'll select will by default be the one used when publishing packages (\`publishConfig.registry\` or \`npmPublishRegistry\` if available, otherwise we'll fallback to the regular \`npmRegistryServer\`).
  `)

  .example(
    `Print username for the default registry`,
    `yarn npm whoami`,
  )

  .example(
    `Print username for the registry on a given scope`,
    `yarn npm whoami --scope company`,
  )

  .action(async ({cwd, stdin, stdout, scope, publish}: {cwd: PortablePath, stdin: Readable, stdout: Writable, scope: string, publish: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);

    let registry: string;
    if (scope && publish)
      registry = npmConfigUtils.getScopeRegistry(scope, {configuration, type: npmConfigUtils.RegistryType.PUBLISH_REGISTRY});
    else if (scope)
      registry = npmConfigUtils.getScopeRegistry(scope, {configuration});
    else if (publish)
      registry = npmConfigUtils.getPublishRegistry((await openWorkspace(configuration, cwd)).manifest, {configuration});
    else
      registry = npmConfigUtils.getDefaultRegistry({configuration});

    const report = await StreamReport.start({configuration, stdout}, async report => {
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
  });

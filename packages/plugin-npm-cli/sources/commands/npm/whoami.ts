import {Configuration, Ident, MessageName}              from '@berry/core';
import {PluginConfiguration, StreamReport, structUtils} from '@berry/core';
import {npmHttpUtils}                                   from '@berry/plugin-npm';
import {Clipanion}                                      from 'clipanion';
import {Readable, Writable}                             from 'stream';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: Clipanion, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`npm whoami [-s,--scope SCOPE]`)
  .categorize(`Npm-related commands`)
  .describe(`display username`)

  .detail(`
    Print the username associated with the current authentication settings to the standard output.

    When using \`-s,--scope\`, the username printed will be the one that matches the authentication for the specific scope (they can be overriden using the \`npmScopes\` settings).
  `)

  .example(
    `Print username for the default registry`,
    `yarn npm whoami`,
  )

  .example(
    `Print username for the registry on a given scope`,
    `yarn npm whoami --scope company`,
  )

  .action(async ({cwd, stdin, stdout, scope}: {cwd: string, stdin: Readable, stdout: Writable, scope: string}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);

    const report = await StreamReport.start({configuration, stdout}, async report => {
      let ident: Ident | null = null;

      if (scope) {
        ident = structUtils.makeIdent(scope, ``);
      }

      try {
        const response = await npmHttpUtils.get(`/-/whoami`, { configuration, ident, authType: npmHttpUtils.AuthType.ALWAYS_AUTH, json: true });

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

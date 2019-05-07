import {Configuration, Ident, MessageName}              from '@berry/core';
import {PluginConfiguration, StreamReport, structUtils} from '@berry/core';
import {npmHttpUtils}                                   from '@berry/plugin-npm';
import {Clipanion}                                      from 'clipanion';
import {Readable, Writable}                             from 'stream';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: Clipanion, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`npm whoami [-s,--scope SCOPE]`)
  .describe(`display username`)

  .detail(`
    Print the registry username to standard output.
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
        const responseBuffer = await npmHttpUtils.get(`/-/whoami`, { configuration, ident, forceAuth: true });
        const jsonResponse = JSON.parse(responseBuffer.toString());

        report.reportInfo(MessageName.UNNAMED, jsonResponse.username);
      } catch (err) {
        if (err.statusCode === 401 || err.statusCode === 403)
          report.reportError(MessageName.AUTHENTICATION_INVALID, `Authentication failed - your credentials may have expired`);

        report.reportError(MessageName.AUTHENTICATION_INVALID, err.toString());
      }
    });

    return report.exitCode();
  });

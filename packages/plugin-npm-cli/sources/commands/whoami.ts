import {Configuration, MessageName, PluginConfiguration, StreamReport} from '@berry/core';
import {httpUtils}                                                     from '@berry/core';
import {Clipanion}                                                     from 'clipanion';
import {Readable, Writable}                                            from 'stream';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: Clipanion, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`npm whoami`)
  .describe(`display username`)

  .detail(`
    Print the registry username to standard output.
  `)

  .example(
    `Print username for the default registry`,
    `yarn npm whoami`,
  )

  .action(async ({cwd, stdin, stdout}: {cwd: string, stdin: Readable, stdout: Writable, registry: string}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);

    const report = await StreamReport.start({configuration, stdout}, async report => {
      const authorization = getAuthorizationHeader(configuration);

      if (authorization === null)
        return report.reportError(MessageName.AUTHENTICATION_NOT_FOUND, `Authentication not found`);

      const headers = { authorization };

      try {
        const registryUrl = getRegistryUrl(configuration);
        const responseBuffer = await httpUtils.get(`${registryUrl}-/whoami`, configuration, { headers });
        const jsonResponse = JSON.parse(responseBuffer.toString());

        report.reportInfo(MessageName.UNNAMED, jsonResponse.username);
      } catch (err) {
        if (err.statusCode === 401)
          report.reportError(MessageName.AUTHENTICATION_INVALID, `Authentication failed - your credentials may have expired`);
      }
    });

    return report.exitCode();
  });

function getRegistryUrl(configuration: Configuration) {
  const url = configuration.get('npmRegistryServer');

  return new URL(url);
}

function getAuthorizationHeader(configuration: Configuration) {
  if (configuration.get(`npmAuthToken`))
    return `Bearer ${configuration.get(`npmAuthToken`)}`;

  if (configuration.get(`npmAuthIdent`))
    return `Basic ${configuration.get(`npmAuthIdent`)}`;

  return null;
}

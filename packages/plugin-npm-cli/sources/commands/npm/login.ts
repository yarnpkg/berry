import {openWorkspace}                     from '@berry/cli';
import {Configuration, MessageName}        from '@berry/core';
import {PluginConfiguration, StreamReport} from '@berry/core';
import {PortablePath}                      from '@berry/fslib';
import {npmConfigUtils, npmHttpUtils}      from '@berry/plugin-npm';
import inquirer                            from 'inquirer';
import {Readable, Writable}                from 'stream';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`npm login [-s,--scope SCOPE] [--publish]`)
  .categorize(`Npm-related commands`)
  .describe(`store new login info to access the npm registry`)

  .detail(`
    This command will ask you for your username, password, and 2FA One-Time-Password (when it applies). It will then modify your local configuration (in your home folder, never in the project itself) to reference the new tokens thus generated.

    Adding the \`-s,--scope\` flag will cause the authentication to be done against whatever registry is configured for the associated scope (see also \`npmScopes\`).

    Adding the \`--publish\` flag will cause the authentication to be done against the registry used when publishing the package (see also \`publishConfig.registry\` and \`npmPublishRegistry\`).
  `)

  .example(
    `Login to the default registry`,
    `yarn npm login`,
  )

  .example(
    `Login to the registry linked to the @my-scope registry`,
    `yarn npm login --scope my-scope`,
  )

  .example(
    `Login to the publish registry for the current package`,
    `yarn npm login --publish`,
  )

  .action(async ({cwd, stdin, stdout, scope, publish}: {cwd: PortablePath, stdin: Readable, stdout: Writable, scope: string, publish: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);

    // @ts-ignore
    const prompt = inquirer.createPromptModule({
      input: stdin,
      output: stdout,
    });

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
      const credentials = await getCredentials(prompt);
      const url = `/-/user/org.couchdb.user:${encodeURIComponent(credentials.name)}`;

      try {
        const response = await npmHttpUtils.put(url, credentials, {
          configuration,
          registry,
          json: true,
          authType: npmHttpUtils.AuthType.NO_AUTH,
        });

        // @ts-ignore
        await setAuthToken(registry, response.token, {configuration});

        return report.reportInfo(MessageName.UNNAMED, `Successfully logged in`);
      } catch (error) {
        return report.reportError(MessageName.AUTHENTICATION_INVALID, `Invalid Authentication`);
      }
    });

    return report.exitCode();
  });

async function setAuthToken(registry: string, npmAuthToken: string, {configuration}: {configuration: Configuration}) {
  return await Configuration.updateHomeConfiguration({
    npmRegistries: (registries: {[key: string]: any} = {}) => ({
      ...registries,
      [registry]: {
        ...registries[registry],
        npmAuthToken,
      },
    }),
  });
}

async function getCredentials(prompt: any) {
  if (process.env.TEST_ENV) {
    return {
      name: process.env.TEST_NPM_USER || '',
      password: process.env.TEST_NPM_PASSWORD || '',
    };
  }

  const {username, password} = await prompt([
    {
      type: `input`,
      name: `username`,
      message: `Username:`,
      validate: (input: string) => validateRequiredInput(input, `Username`),
    },
    {
      type: `password`,
      name: `password`,
      message: `Password:`,
      validate: (input: string) => validateRequiredInput(input, `Password`),
    },
  ]);

  return {
    name: username,
    password,
  }
}

function validateRequiredInput(input: string, message: string) {
  return input.length > 0
    ? true
    : `${message} is required`
}

import {openWorkspace}                              from '@berry/cli';
import {CommandContext, Configuration, MessageName} from '@berry/core';
import {StreamReport}                               from '@berry/core';
import {npmConfigUtils, npmHttpUtils}               from '@berry/plugin-npm';
import {Command}                                    from 'clipanion';
import inquirer                                     from 'inquirer';

// eslint-disable-next-line arca/no-default-export
export default class NpmLoginCommand extends Command<CommandContext> {
  @Command.String(`-s,--scope`)
  scope?: string;

  @Command.Boolean(`--publish`)
  publish: boolean = false;

  static usage = Command.Usage({
    category: `Npm-related commands`,
    description: `store new login info to access the npm registry`,
    details: `
      This command will ask you for your username, password, and 2FA One-Time-Password (when it applies). It will then modify your local configuration (in your home folder, never in the project itself) to reference the new tokens thus generated.

      Adding the \`-s,--scope\` flag will cause the authentication to be done against whatever registry is configured for the associated scope (see also \`npmScopes\`).

      Adding the \`--publish\` flag will cause the authentication to be done against the registry used when publishing the package (see also \`publishConfig.registry\` and \`npmPublishRegistry\`).
    `,
    examples: [[
      `Login to the default registry`,
      `yarn npm login`,
    ], [
      `Login to the registry linked to the @my-scope registry`,
      `yarn npm login --scope my-scope`,
    ], [
      `Login to the publish registry for the current package`,
      `yarn npm login --publish`,
    ]],
  });

  @Command.Path(`npm`, `login`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    // @ts-ignore
    const prompt = inquirer.createPromptModule({
      input: this.context.stdin,
      output: this.context.stdout,
    });

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
  }
}

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

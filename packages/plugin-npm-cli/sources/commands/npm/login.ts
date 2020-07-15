import {BaseCommand, openWorkspace}         from '@yarnpkg/cli';
import {Configuration, MessageName, Report} from '@yarnpkg/core';
import {StreamReport}                       from '@yarnpkg/core';
import {PortablePath}                       from '@yarnpkg/fslib';
import {npmConfigUtils, npmHttpUtils}       from '@yarnpkg/plugin-npm';
import {Command, Usage}                     from 'clipanion';
import {prompt}                             from 'enquirer';

// eslint-disable-next-line arca/no-default-export
export default class NpmLoginCommand extends BaseCommand {
  @Command.String(`-s,--scope`)
  scope?: string;

  @Command.Boolean(`--publish`)
  publish: boolean = false;

  static usage: Usage = Command.Usage({
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

    const registry: string = await getRegistry({
      configuration,
      cwd: this.context.cwd,
      publish: this.publish,
      scope: this.scope,
    });

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async report => {
      const credentials = await getCredentials({
        registry,
        report,
        stdin: this.context.stdin as NodeJS.ReadStream,
        stdout: this.context.stdout as NodeJS.WriteStream,
      });
      const url = `/-/user/org.couchdb.user:${encodeURIComponent(credentials.name)}`;

      const response = await npmHttpUtils.put(url, credentials, {
        attemptedAs: credentials.name,
        configuration,
        registry,
        json: true,
        authType: npmHttpUtils.AuthType.NO_AUTH,
      }) as any;

      await setAuthToken(registry, response.token, {configuration});
      return report.reportInfo(MessageName.UNNAMED, `Successfully logged in`);
    });

    return report.exitCode();
  }
}

export async function getRegistry({scope, publish, configuration, cwd}: {scope?: string, publish: boolean, configuration: Configuration, cwd: PortablePath}) {
  if (scope && publish)
    return npmConfigUtils.getScopeRegistry(scope, {configuration, type: npmConfigUtils.RegistryType.PUBLISH_REGISTRY});

  if (scope)
    return npmConfigUtils.getScopeRegistry(scope, {configuration});

  if (publish)
    return npmConfigUtils.getPublishRegistry((await openWorkspace(configuration, cwd)).manifest, {configuration});

  return npmConfigUtils.getDefaultRegistry({configuration});
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

async function getCredentials({registry, report, stdin, stdout}: {registry: string, report: Report, stdin: NodeJS.ReadStream, stdout: NodeJS.WriteStream}) {
  if (process.env.TEST_ENV) {
    return {
      name: process.env.TEST_NPM_USER || ``,
      password: process.env.TEST_NPM_PASSWORD || ``,
    };
  }

  report.reportInfo(MessageName.UNNAMED, `Logging in to ${registry}`);

  let isToken = false;

  if (registry.match(/^https:\/\/npm\.pkg\.github\.com(\/|$)/)) {
    report.reportInfo(MessageName.UNNAMED, `You seem to be using the GitHub Package Registry. Tokens must be generated with the 'repo', 'write:packages', and 'read:packages' permissions.`);
    isToken = true;
  }

  report.reportSeparator();

  const {username, password} = await prompt([{
    type: `input`,
    name: `username`,
    message: `Username:`,
    required: true,
    onCancel: () => process.exit(130),
    stdin,
    stdout,
  }, {
    type: `password`,
    name: `password`,
    message: isToken ? `Token:` : `Password:`,
    required: true,
    onCancel: () => process.exit(130),
    stdin,
    stdout,
  }]);

  report.reportSeparator();

  return {
    name: username,
    password,
  };
}

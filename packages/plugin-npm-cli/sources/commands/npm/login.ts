import {BaseCommand, openWorkspace}                                 from '@yarnpkg/cli';
import {Configuration, MessageName, Report, miscUtils, formatUtils} from '@yarnpkg/core';
import {StreamReport}                                               from '@yarnpkg/core';
import {PortablePath}                                               from '@yarnpkg/fslib';
import {npmConfigUtils, npmHttpUtils}                               from '@yarnpkg/plugin-npm';
import {Command, Option, Usage}                                     from 'clipanion';
import {prompt}                                                     from 'enquirer';

// eslint-disable-next-line arca/no-default-export
export default class NpmLoginCommand extends BaseCommand {
  static paths = [
    [`npm`, `login`],
  ];

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

  scope = Option.String(`-s,--scope`, {
    description: `Login to the registry configured for a given scope`,
  });

  publish = Option.Boolean(`--publish`, false, {
    description: `Login to the publish registry`,
  });

  alwaysAuth = Option.Boolean(`--always-auth`, {
    description: `Set the npmAlwaysAuth configuration`,
  });

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
      includeFooter: false,
    }, async report => {
      const credentials = await getCredentials({
        configuration,
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
        jsonResponse: true,
        authType: npmHttpUtils.AuthType.NO_AUTH,
      }) as any;

      await setAuthToken(registry, response.token, {alwaysAuth: this.alwaysAuth, scope: this.scope});
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

async function setAuthToken(registry: string, npmAuthToken: string, {alwaysAuth, scope}: {alwaysAuth?: boolean, scope?: string}) {
  const makeUpdater = (entryName: string) => (unknownStore: unknown) => {
    const store = miscUtils.isIndexableObject(unknownStore)
      ? unknownStore
      : {};

    const entryUnknown = store[entryName];
    const entry = miscUtils.isIndexableObject(entryUnknown)
      ? entryUnknown
      : {};

    return {
      ...store,
      [entryName]: {
        ...entry,
        ...(alwaysAuth !== undefined ? {npmAlwaysAuth: alwaysAuth} : {}),
        npmAuthToken,
      },
    };
  };

  const update = scope
    ? {npmScopes: makeUpdater(scope)}
    : {npmRegistries: makeUpdater(registry)};

  return await Configuration.updateHomeConfiguration(update);
}

async function getCredentials({configuration, registry, report, stdin, stdout}: {configuration: Configuration, registry: string, report: Report, stdin: NodeJS.ReadStream, stdout: NodeJS.WriteStream}) {
  report.reportInfo(MessageName.UNNAMED, `Logging in to ${formatUtils.pretty(configuration, registry, formatUtils.Type.URL)}`);

  let isToken = false;

  if (registry.match(/^https:\/\/npm\.pkg\.github\.com(\/|$)/)) {
    report.reportInfo(MessageName.UNNAMED, `You seem to be using the GitHub Package Registry. Tokens must be generated with the 'repo', 'write:packages', and 'read:packages' permissions.`);
    isToken = true;
  }

  report.reportSeparator();

  if (process.env.YARN_IS_TEST_ENV) {
    return {
      name: process.env.YARN_INJECT_NPM_USER || ``,
      password: process.env.YARN_INJECT_NPM_PASSWORD || ``,
    };
  }

  const {username, password} = await prompt<{
    username: string;
    password: string;
  }>([{
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

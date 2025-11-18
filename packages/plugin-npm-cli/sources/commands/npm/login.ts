import {BaseCommand, openWorkspace}                                                       from '@yarnpkg/cli';
import {Configuration, MessageName, Report, miscUtils, formatUtils, nodeUtils, httpUtils} from '@yarnpkg/core';
import {StreamReport}                                                                     from '@yarnpkg/core';
import {PortablePath}                                                                     from '@yarnpkg/fslib';
import {npmConfigUtils, npmHttpUtils}                                                     from '@yarnpkg/plugin-npm';
import {Command, Option, Usage}                                                           from 'clipanion';
import {prompt}                                                                           from 'enquirer';

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

  webLogin = Option.Boolean(`--web-login`, {
    description: `Enable web login`,
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
      const token = await performAuthentication({
        registry,
        configuration,
        report,
        webLogin: this.webLogin,
        stdin: this.context.stdin as NodeJS.ReadStream,
        stdout: this.context.stdout as NodeJS.WriteStream,
      });

      await setAuthToken(registry, token, {alwaysAuth: this.alwaysAuth, scope: this.scope});
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

type NpmWebLoginInitResponse = {
  loginUrl: string;
  doneUrl: string;
};

async function webLoginInit(registry: string, configuration: Configuration): Promise<NpmWebLoginInitResponse | null> {
  let response: any;
  try {
    response = await npmHttpUtils.post(`/-/v1/login`, null, {
      configuration,
      registry,
      authType: npmHttpUtils.AuthType.NO_AUTH,
      jsonResponse: true,
      headers: {
        [`npm-auth-type`]: `web`,
      },
    });
  } catch {
    return null;
  }

  return response;
}

type NpmWebLoginCheckResponse =
  | {type: `success`, token: string}
  | {type: `waiting`, sleep: number};

async function webLoginCheck(doneUrl: string, configuration: Configuration): Promise<NpmWebLoginCheckResponse | null> {
  const response = await httpUtils.request(doneUrl, null, {
    configuration,
    jsonResponse: true,
  });

  if (response.statusCode === 202) {
    const retryAfter = response.headers[`retry-after`] ?? `1`;
    return {type: `waiting`, sleep: parseInt(retryAfter, 10)};
  }

  if (response.statusCode === 200)
    return {type: `success`, token: response.body.token};

  return null;
}

async function loginViaWeb({registry, configuration, report}: CredentialOptions): Promise<string | null> {
  const loginResponse = await webLoginInit(registry, configuration);
  if (!loginResponse)
    return null;

  if (nodeUtils.openUrl) {
    report.reportInfo(MessageName.UNNAMED, `Starting the web login process...`);
    report.reportSeparator();

    const {openNow} = await prompt<{openNow: boolean}>({
      type: `confirm`,
      name: `openNow`,
      message: `Do you want to try to open your browser now?`,
      required: true,
      initial: true,
      onCancel: () => process.exit(130),
    });

    report.reportSeparator();

    if (!openNow || !await nodeUtils.openUrl(loginResponse.loginUrl)) {
      report.reportWarning(MessageName.UNNAMED, `We failed to automatically open the url; you'll have to open it yourself in your browser of choice:`);
      report.reportWarning(MessageName.UNNAMED, formatUtils.pretty(configuration, loginResponse.loginUrl, formatUtils.Type.URL));
      report.reportSeparator();
    }
  }

  while (true) {
    const sleepDuration = await webLoginCheck(loginResponse.doneUrl, configuration);
    if (sleepDuration === null)
      return null;

    if (sleepDuration.type === `waiting`) {
      await new Promise(resolve => setTimeout(resolve, sleepDuration.sleep * 1000));
    } else {
      return sleepDuration.token;
    }
  }
}

const WEB_LOGIN_REGISTRIES = [
  `https://registry.yarnpkg.com`,
  `https://registry.npmjs.org`,
];

async function performAuthentication(opts: CredentialOptions & {webLogin?: boolean}): Promise<string> {
  if (opts.webLogin ?? WEB_LOGIN_REGISTRIES.includes(opts.registry)) {
    const webToken = await loginViaWeb(opts);
    if (webToken !== null) {
      return webToken;
    }
  }

  return await loginOrRegisterViaPassword(opts);
}

/**
 * Register a new user, or login if the user already exists
 */
async function loginOrRegisterViaPassword({registry, configuration, report, stdin, stdout}: CredentialOptions): Promise<string> {
  const credentials = await getCredentials({
    configuration,
    registry,
    report,
    stdin,
    stdout,
  });

  // Registration and login are both handled as a `put` by npm. Npm uses a lax
  // endpoint as of 2023-11 where there are no conflicts if the user already
  // exists, but some registries such as Verdaccio are stricter and return a
  // `409 Conflict` status code for existing users. In this case, the client
  // should put a user revision for this specific session (with basic HTTP
  // auth).
  //
  // The code below is based on the logic from the npm client.
  // <https://github.com/npm/npm-profile/blob/30097a5eef4239399b964c2efc121e64e75ecaf5/lib/index.js#L156>.
  const userUrl = `/-/user/org.couchdb.user:${encodeURIComponent(credentials.name)}`;

  const body: Record<string, unknown> = {
    _id: `org.couchdb.user:${credentials.name}`,
    name: credentials.name,
    password: credentials.password,
    type: `user`,
    roles: [],
    date: new Date().toISOString(),
  };

  const userOptions = {
    attemptedAs: credentials.name,
    configuration,
    registry,
    jsonResponse: true,
    authType: npmHttpUtils.AuthType.NO_AUTH,
  };

  try {
    const response = await npmHttpUtils.put(userUrl, body, userOptions) as any;
    return response.token;
  } catch (error) {
    const isConflict = error.originalError?.name === `HTTPError` && error.originalError?.response.statusCode === 409;
    if (!isConflict) {
      throw error;
    }
  }

  // At this point we did a first request but got a `409 Conflict`. Retrieve
  // the latest state and put a new revision.
  const revOptions = {
    ...userOptions,
    authType: npmHttpUtils.AuthType.NO_AUTH,
    headers: {
      authorization: `Basic ${Buffer.from(`${credentials.name}:${credentials.password}`).toString(`base64`)}`,
    },
  };

  const user = await npmHttpUtils.get(userUrl, revOptions);

  // Update the request body to include the latest fields (such as `_rev`) and
  // the latest `roles` value.
  for (const [k, v] of Object.entries(user)) {
    if (!body[k] || k === `roles`) {
      body[k] = v;
    }
  }

  const revisionUrl = `${userUrl}/-rev/${body._rev}`;
  const response = await npmHttpUtils.put(revisionUrl, body, revOptions) as any;

  return response.token;
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

interface Credentials {
  name: string;
  password: string;
}

interface CredentialOptions {
  configuration: Configuration;
  registry: string;
  report: Report;
  stdin: NodeJS.ReadStream;
  stdout: NodeJS.WriteStream;
}

async function getCredentials({configuration, registry, report, stdin, stdout}: CredentialOptions): Promise<Credentials> {
  report.reportInfo(MessageName.UNNAMED, `Logging in to ${formatUtils.pretty(configuration, registry, formatUtils.Type.URL)}`);

  let isToken = false;

  if (registry.match(/^https:\/\/npm\.pkg\.github\.com(\/|$)/)) {
    report.reportInfo(MessageName.UNNAMED, `You seem to be using the GitHub Package Registry. Tokens must be generated with the 'repo', 'write:packages', and 'read:packages' permissions.`);
    isToken = true;
  }

  report.reportSeparator();

  if (configuration.env.YARN_IS_TEST_ENV) {
    return {
      name: configuration.env.YARN_INJECT_NPM_USER || ``,
      password: configuration.env.YARN_INJECT_NPM_PASSWORD || ``,
    };
  }

  const credentials = await prompt<Credentials>([{
    type: `input`,
    name: `name`,
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

  return credentials;
}

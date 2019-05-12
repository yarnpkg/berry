import {Configuration, Ident, MessageName}              from '@berry/core';
import {PluginConfiguration, StreamReport, structUtils} from '@berry/core';
import {npmHttpUtils}                                   from '@berry/plugin-npm';
import inquirer                                         from 'inquirer';
import {Readable, Writable}                             from 'stream';
import { PortablePath } from '@berry/fslib';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`npm login [-s,--scope SCOPE]`)
  .categorize(`Npm-related commands`)
  .describe(`login to registry`)

  .detail(`
    This command will ask you for your username, password, and 2FA One-Time Password (when it applies). It will then modify your local configuration (in your home folder) to reference the new tokens thus generated.

    Adding the \`-s,--scope\` flag will cause the authentication to be done against whatever registry is configured for the associated scope (see also \`npmScopes\`).
  `)

  .example(
    `Login to the default registry`,
    `yarn npm login`,
  )

  .example(
    `Login to a scoped registry`,
    `yarn npm login --scope my-scope`,
  )

  .action(async ({cwd, stdin, stdout, scope}: {cwd: PortablePath, stdin: Readable, stdout: Writable, scope: string}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);

    // @ts-ignore
    const prompt = inquirer.createPromptModule({
      input: stdin,
      output: stdout,
    });

    const report = await StreamReport.start({configuration, stdout}, async report => {
      let ident: Ident | null = null;

      if (scope) {
        ident = structUtils.makeIdent(scope, ``);
      }

      const credentials = await getCredentials(prompt);
      const url = `/-/user/org.couchdb.user:${encodeURIComponent(credentials.name)}`;
      const requestOptions = {
        configuration,
        ident,
        json: true,
        authType: npmHttpUtils.AuthType.NO_AUTH,
      };

      try {
        const response = await npmHttpUtils.put(url, credentials, requestOptions);

        // @ts-ignore
        await setAuthToken(ident, response.token);

        return report.reportInfo(MessageName.UNNAMED, `Successfully logged in`);
      } catch (error) {
        return report.reportError(MessageName.AUTHENTICATION_INVALID, `Invalid Authentication`);
      }
    });

    return report.exitCode();
  });

async function setAuthToken(ident: Ident | null, npmAuthToken: string) {
  const scope = ident && ident.scope;

  if (scope) {
    return await Configuration.updateHomeConfiguration({
      npmScopes: (scopes: {[key: string]: any} = {}) => ({
        ... scopes,
        [scope]: {
          ... scopes[scope],
          npmAuthToken,
        },
      }),
    });
  }

  return await Configuration.updateHomeConfiguration({npmAuthToken});
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
      validate: (input: string) => validateRequiredInput(input, `Username`)
    },
    {
      type: `password`,
      name: `password`,
      message: `Password:`,
      validate: (input: string) => validateRequiredInput(input, `Password`)
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

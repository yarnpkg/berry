import {Configuration, MessageName}                     from '@berry/core';
import {PluginConfiguration, StreamReport}              from '@berry/core';
import {npmConfigUtils, npmHttpUtils}                   from '@berry/plugin-npm';
import inquirer                                         from 'inquirer';
import {Readable, Writable}                             from 'stream';
import {URL}                                            from 'url';

const SUCCESS_MESSAGE = `Successfully logged in`;
const ERROR_MESSAGE = `Invalid Authentication`;

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`npm login [-r,--registry REGISTRY]`)
  .categorize(`Npm-related commands`)
  .describe(`login to registry`)

  .detail(`
    This command will ask you for your registry username, email, password, and One-time password (when it applies).
  `)

  .example(
    `Login to the default registry`,
    `yarn npm login`,
  )

  .example(
    `Login to a custom registry`,
    `yarn npm login --registry http://localhost:4873`,
  )

  .action(async ({cwd, stdin, stdout, registry}: {cwd: string, stdin: Readable, stdout: Writable, registry: string}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);

    // @ts-ignore
    const prompt = inquirer.createPromptModule({
      input: stdin,
      output: stdout,
    });

    const report = await StreamReport.start({configuration, stdout}, async report => {
      const registryUrl = registry ? new URL(registry).toString() : null;
      const credentials = await getCredentials(prompt);
      const url = `/-/user/org.couchdb.user:${encodeURIComponent(credentials.name)}`;
      const requestOptions = {
        configuration,
        ident: null,
        json: true,
        forceAuth: false,
        registryUrl,
      };

      // First we try to login only using the credentials (no otp)
      try {
        const response = await npmHttpUtils.put(url, credentials, requestOptions);

        // If login succeeds here, go ahead and save the token to the home config, report and exit
        // @ts-ignore
        await setAuthToken(configuration, response.token);

        return report.reportInfo(MessageName.UNNAMED, SUCCESS_MESSAGE);
      } catch(error) {
        // If our first try is an error could be one of two options:
        // - An actual error (such as invalid credentials)
        // - Missing OTP
        if (!authRequiresOtp(error))
          return report.reportError(MessageName.AUTHENTICATION_INVALID, ERROR_MESSAGE);
      }

      // If missing OTP was the issue, ask the user for the OTP and try again
      // setting the according otp header
      const otp = await getOtp(prompt);

      try {
        const headers = getOtpHeaders(otp);
        const response = await npmHttpUtils.put(url, credentials, {...requestOptions, headers});

        // @ts-ignore
        await setAuthToken(configuration, response.token);

        return report.reportInfo(MessageName.UNNAMED, SUCCESS_MESSAGE);
      } catch(error) {
        return report.reportError(MessageName.AUTHENTICATION_INVALID, ERROR_MESSAGE);
      }
    });

    return report.exitCode();
  });

async function setAuthToken(configuration: Configuration, npmAuthToken: string) {
  const registry = npmConfigUtils.getRegistry(null, {configuration});

  await Configuration.updateHomeConfiguration({
    npmRegistries: {
      [registry]: {
        npmAuthToken,
      },
    },
  });
}

async function getCredentials(prompt: any) {
  const { username, password, email } = await prompt([
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
    {
      type: `input`,
      name: `email`,
      message: `Email:`,
      validate: (input: string) => validateRequiredInput(input, `Email`)
    }
  ]);

  return {
    name: username,
    password,
    email,
  }
}

async function getOtp(prompt: any) {
  const { otp } = await prompt({
    type: `input`,
    name: `otp`,
    message: `One-time password:`,
    validate: (input: string) => validateRequiredInput(input, `One-time password`)
  });

  return otp;
}

function validateRequiredInput(input: string, message: string) {
  return input.length > 0
    ? true
    : `${message} is required`
}

function authRequiresOtp(error: any) {
  try {
    const authMethods = error.headers['www-authenticate'].split(/,\s*/).map((s: string) => s.toLowerCase());

    return authMethods.includes('otp');
  } catch(e) {
    return false;
  }
}

function getOtpHeaders(otp: string) {
  return {
    [`npm-otp`]: otp,
  };
}

import {httpUtils}         from '@yarnpkg/core';
import {npmHttpUtils}      from '@yarnpkg/plugin-npm';


import {makePublishBody}   from '../sources/npmPublishUtils';
import * as utils          from '../sources';

import {makeConfiguration} from './_makeConfiguration';

const {
  exec: {execFile},
  tests: {validLogins},
} = require(`pkg-tests-core`);


describe(`npmHttpUtils.put`, () => {
  // it(`should publish`, () => {
  //   const body = makePublishBody({});
  //   fsUtils.
  // });

  test(`should publish package with readme content`, makeTemporaryEnv({
    name: `otp-required`,
    version: `1.0.0`,
  }, async ({path, run, source}) => {
    await run(`install`);
    //@ts-expect-error
    await fsUtils.writeFile(`${path}/README.md`, `# title\n`);
    const res = await run(`npm`, `publish`, `--otp`, validLogins.otpUser.npmOtpToken, {
      env: {
        YARN_NPM_AUTH_TOKEN: validLogins.otpUser.npmAuthToken,
      },
    });

    // expect(spy).toHaveBeenCalledWith({});
  }));
});

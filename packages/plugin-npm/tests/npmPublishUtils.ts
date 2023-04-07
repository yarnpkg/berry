import {httpUtils}         from '@yarnpkg/core';
import {npmHttpUtils}      from '@yarnpkg/plugin-npm';


import {makePublishBody}   from '../sources/npmPublishUtils';
import * as utils          from '../sources';

import {makeConfiguration} from './_makeConfiguration';

const {
  exec: {execFile},
  tests: {validLogins},
} = require(`pkg-tests-core`);


describe(`makePublishBody`, () => {
  // Example of unit

  // it(`should publish`, async () => {
  //   const workspace = aWorkspace();
  //   const files = await packUtils.genPackList(workspace);
  //   const pack = await packUtils.genPackStream(workspace, files);
  //   const buffer = await miscUtils.bufferStream(pack);

  //   const publishAdditionalParams = aPublishAdditionalParams();

  //   const body = await makePublishBody(workspace, buffer, publishAdditionalParams);
  //   expect(body.readme).toStrictEqual(`# asd`);
  // });

  // Example of e2e

  // test(`should publish package with readme content`, makeTemporaryEnv({
  //   name: `otp-required`,
  //   version: `1.0.0`,
  // }, async ({path, run, source}) => {
  //   const spy = jest.spyOn(httpUtils, `put`);
  //   await run(`install`);
  //   await fsUtils.writeFile(`${path}/README.md`, `# title\n`);
  //   const res = await run(`npm`, `publish`, `--otp`, validLogins.otpUser.npmOtpToken, {
  //     env: {
  //       YARN_NPM_AUTH_TOKEN: validLogins.otpUser.npmAuthToken,
  //     },
  //   });

  //   expect(spy).toHaveBeenCalledWith({});
  // }));
});

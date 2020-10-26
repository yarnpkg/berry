import {xfs}           from "@yarnpkg/fslib";

import {Configuration} from "../sources/Configuration";

import * as httpUtils  from "../sources/httpUtils";

describe(`httpUtils`, () => {
  it(`it should fail to make requests to a blocked hostname`, async () => {
    await xfs.mktempPromise(async tmp => {
      await Configuration.updateConfiguration(tmp, {
        networkSettings: {
          "*": {enableNetwork: false},
          "registry.yarnpkg.com": {enableNetwork: true},
        },
      });

      const configuration = await Configuration.find(
        tmp,
        {
          modules: new Map(),
          plugins: new Set(),
        },
        {strict: false}
      );

      await expect(httpUtils.get(`https://registry.npmjs.org`, {configuration})).rejects.toMatchObject({
        message: `Requests to 'https://registry.npmjs.org' has been blocked because of your configuration settings`,
      });

      await expect(httpUtils.get(`https://registry.yarnpkg.com`, {configuration, jsonResponse: true})).resolves.toMatchObject({
        // eslint-disable-next-line @typescript-eslint/naming-convention
        db_name: `registry`,
      });
    });
  });
});

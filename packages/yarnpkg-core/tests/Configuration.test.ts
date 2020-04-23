import {xfs, PortablePath}     from '@yarnpkg/fslib';
import NpmPlugin               from '@yarnpkg/plugin-npm';

import {Configuration, SECRET} from '../sources/Configuration';

async function initializeConfiguration<T>(value: {[key: string]: any}, cb: (dir: PortablePath) => Promise<T>) {
  return await xfs.mktempPromise(async dir => {
    await Configuration.updateConfiguration(dir, value);

    return await cb(dir);
  });
}

describe(`Configuration`, () => {
  it(`should hide secrets`, async () => {
    await initializeConfiguration({
      npmAuthToken: `my-token`,
      npmScopes: {
        myScope: {
          npmAuthToken: `my-token`,
        },
      },
    }, async dir => {
      const configuration = await Configuration.find(dir, {
        modules: new Map([[`@yarnpkg/plugin-npm`, NpmPlugin]]),
        plugins: new Set([`@yarnpkg/plugin-npm`]),
      });

      const firstToken = configuration.getRedacted(`npmAuthToken`);
      const secondToken = configuration.getRedacted(`npmScopes`).get(`myScope`).get(`npmAuthToken`);

      expect(firstToken).toEqual(SECRET);
      expect(secondToken).toEqual(SECRET);
    });
  });
});

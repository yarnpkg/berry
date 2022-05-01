import {Configuration}       from '@yarnpkg/core';
import {xfs, PortablePath}   from '@yarnpkg/fslib';

import {colorizeVersionDiff} from '../sources/colorizeUtils';

async function initializeConfiguration<T>(value: {[key: string]: any}, cb: (dir: PortablePath) => Promise<T>) {
  return await xfs.mktempPromise(async dir => {
    await Configuration.updateConfiguration(dir, value);

    return await cb(dir);
  });
}

describe(`colorizeUtils`, () => {
  describe(`colorizeVersionDiff`, () => {
    it(`should keep the same version if there is no difference`, async () => {
      await initializeConfiguration({}, async dir => {
        const configuration = await Configuration.find(dir, null);
        expect(colorizeVersionDiff(configuration, `^2.0.0`, `^2.0.0`)).toBe(`^2.0.0`);
      });
    });

    it(`should handle semver without modifier part`, async () => {
      await initializeConfiguration({}, async dir => {
        const configuration = await Configuration.find(dir, null);
        expect(colorizeVersionDiff(configuration, `2.0.0`, `2.1.0`)).toMatchSnapshot();
      });
    });

    it(`should handle semver with prerelease part`, async () => {
      await initializeConfiguration({}, async dir => {
        const configuration = await Configuration.find(dir, null);
        expect(colorizeVersionDiff(configuration, `^2.0.0-beta.17`, `^2.0.0-beta.18`)).toMatchSnapshot();
      });
    });
  });
});

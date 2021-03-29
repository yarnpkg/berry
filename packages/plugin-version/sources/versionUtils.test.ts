import * as versionUtils from './versionUtils';

describe(`versionUtils`, () => {
  describe(`applyPrerelease`, () => {
    it(`should add the given prerelease pattern when needed`, () => {
      expect(versionUtils.applyPrerelease(`1.2.3`, {current: `1.2.3`, prerelease: `rc.%n`})).toEqual(`1.2.3-rc.1`);
    });

    it(`should bump the prerelease number if there's already one`, () => {
      expect(versionUtils.applyPrerelease(`1.2.3`, {current: `1.2.3-rc.41`, prerelease: `rc.%n`})).toEqual(`1.2.3-rc.42`);
    });

    it(`should reset the prerelease number when the version would change`, () => {
      expect(versionUtils.applyPrerelease(`1.3.0`, {current: `1.2.3-rc.41`, prerelease: `rc.%n`})).toEqual(`1.3.0-rc.1`);
    });
  });
});

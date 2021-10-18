import {Filename,  ppath, xfs} from '@yarnpkg/fslib';

import * as scriptUtils        from '../sources/scriptUtils';

describe(`scriptUtils`, () => {
  describe(`detectPackageManager`, () => {
    const expectations: Record<string, scriptUtils.PackageManager | undefined> = {
      "yarn@1.2.3": scriptUtils.PackageManager.Yarn1,
      "yarn@2.3.4": scriptUtils.PackageManager.Yarn2,
      "yarn@3": scriptUtils.PackageManager.Yarn2,
      "yarn@100": scriptUtils.PackageManager.Yarn2,
      "npm@7": scriptUtils.PackageManager.Npm,
      "pnpm@1": scriptUtils.PackageManager.Pnpm,
      // invalid but defaults to yarn 2
      "yarn@bar": scriptUtils.PackageManager.Yarn2,
      // invalid
      "foo@1": undefined,
      // invalid because of spaces
      " yarn@1.2.3 ": undefined,
      // normally invalid, but we parse them anyway
      yarn: scriptUtils.PackageManager.Yarn2,
      npm: scriptUtils.PackageManager.Npm,
      pnpm: scriptUtils.PackageManager.Pnpm,
    };

    it.each(Object.keys(expectations))(`should pass expectations with %p in packageManager property in manifest`, async packageManager => {
      await xfs.mktempPromise(async dir => {
        await xfs.writeJsonPromise(ppath.join(dir, Filename.manifest), {
          name: `foo`,
          packageManager,
        });

        const pm = await scriptUtils.detectPackageManager(dir);
        expect(pm?.packageManager).toBe(expectations[packageManager]);
      });
    });
  });
});

import {Filename, npath, ppath, xfs} from '@yarnpkg/fslib';
import fs                            from 'fs';

import {readPackageScope}            from '../sources/loader/nodeUtils';

describe(`nodeUtils`, () => {
  it(`should cache present and missing package manifests`, () => {
    xfs.mktempSync(tmpDir => {
      const packageDir = ppath.join(tmpDir, `package`);
      const moduleDir = ppath.join(packageDir, `lib/level-1/level-2`);
      const packageJson = ppath.join(packageDir, Filename.manifest);

      xfs.mkdirpSync(moduleDir);
      xfs.writeJsonSync(packageJson, {
        name: `test-package`,
        description: `This field isn't needed to determine the module format`,
        type: `module`,
      });

      const existsSync = jest.spyOn(fs, `existsSync`);
      const readFileSync = jest.spyOn(fs, `readFileSync`);

      try {
        const firstScope = readPackageScope(npath.fromPortablePath(ppath.join(moduleDir, `first.js`)));
        const secondScope = readPackageScope(npath.fromPortablePath(ppath.join(moduleDir, `second.js`)));

        expect(firstScope).toEqual({
          data: {type: `module`},
          path: npath.fromPortablePath(packageDir),
        });
        expect(secondScope).toEqual(firstScope);

        const checkedManifests = [
          ppath.join(moduleDir, Filename.manifest),
          ppath.join(ppath.dirname(moduleDir), Filename.manifest),
          ppath.join(ppath.dirname(ppath.dirname(moduleDir)), Filename.manifest),
          packageJson,
        ].map(manifestPath => npath.fromPortablePath(manifestPath));

        for (const manifestPath of checkedManifests)
          expect(existsSync.mock.calls.filter(([path]) => path === manifestPath)).toHaveLength(1);

        const nativePackageJson = npath.fromPortablePath(packageJson);
        expect(readFileSync.mock.calls.filter(([path]) => path === nativePackageJson)).toHaveLength(1);
      } finally {
        existsSync.mockRestore();
        readFileSync.mockRestore();
      }
    });
  });
});

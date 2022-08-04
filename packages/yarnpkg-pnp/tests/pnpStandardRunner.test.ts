import {Filename, npath, PortablePath, ppath, ZipFS} from '@yarnpkg/fslib';
import {getLibzipSync}                               from '@yarnpkg/libzip';

import {hydratePnpFile}                              from '../sources';

import expectations                                  from './testExpectations.json';

const projectRoot = `/path/to/project` as PortablePath;

process.env.PNP_DEBUG_LEVEL = `0`;

for (const {manifest, tests} of expectations) {
  const fakeFs = new ZipFS(null, {
    libzip: getLibzipSync(),
  });

  fakeFs.mkdirSync(projectRoot, {recursive: true});

  const pnpApiFile = ppath.join(projectRoot, `.pnp.cjs` as Filename);
  fakeFs.writeFileSync(pnpApiFile, `/* something */`);

  const pnpDataFile = ppath.join(projectRoot, `.pnp.data.json` as Filename);
  fakeFs.writeJsonSync(pnpDataFile, manifest);

  for (const test of tests) {
    it(test.it, async () => {
      const pnpApi = await hydratePnpFile(pnpDataFile, {fakeFs, pnpapiResolution: pnpApiFile});

      const imported = test.imported;
      const importer = npath.fromPortablePath(test.importer);

      if (test.expected === `error!`) {
        expect(() => {
          pnpApi.resolveToUnqualified(imported, importer);
        }).toThrow();
      } else {
        const resolution = pnpApi.resolveToUnqualified(imported, importer);
        const expectation = test.expected !== null
          ? npath.fromPortablePath(test.expected as PortablePath)
          : null;

        expect(resolution).toEqual(expectation);
      }
    });
  }
}

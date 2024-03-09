import {CwdFS, MountFS, NodeFS, PortablePath, npath, ppath} from '../sources';

describe(`MountFS`, () => {
  it(`should fix the dirent entries returned by readdir w/ withFileTypes`, () => {
    const pkgDir = ppath.dirname(npath.toPortablePath(__dirname));

    const mountFs = MountFS.createFolderMount({
      baseFs: new CwdFS(pkgDir, {baseFs: new NodeFS()}),
      mountPoint: ppath.join(pkgDir, `tests`),
      targetPath: ppath.join(pkgDir, `sources`),
    });

    const entries = mountFs.readdirSync(`tests` as PortablePath, {withFileTypes: true});
    const indexEntry = entries.find(entry => entry.name === `index.ts`);

    expect(indexEntry.path).toEqual(`tests` as PortablePath);
  });
});

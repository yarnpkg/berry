import {SubFS}                              from '../sources/SubFS';
import {NodeFS, PortablePath, npath, ppath} from '../sources';

describe(`SubFS`, () => {
  it(`should fix the dirent entries returned by readdir w/ withFileTypes`, () => {
    const pkgDir = ppath.dirname(npath.toPortablePath(__dirname));

    const nodeFs = new NodeFS();
    const subFs = new SubFS(pkgDir, {baseFs: nodeFs});

    const entries = subFs.readdirSync(`tests` as PortablePath, {withFileTypes: true});
    const thisTestEntry = entries.find(entry => entry.name === `SubFS.test.ts`);

    expect(thisTestEntry.path).toEqual(`tests` as PortablePath);
  });
});

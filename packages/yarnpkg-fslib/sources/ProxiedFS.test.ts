import {NoFS}                from './NoFS';
import {ProxiedFS}           from './ProxiedFS';
import {PortablePath, ppath} from './path';

describe(`ProxiedFS`, () => {
  it(`should resolve relative symlinks after remapping`, async () => {
    class SpyFS extends NoFS {
      // @ts-expect-error
      symlinkPromise = jest.fn(async () => {});

      // @ts-expect-error
      symlinkSync = jest.fn(() => {});
    }

    class TestFS extends ProxiedFS<PortablePath, PortablePath> {
      constructor(protected baseFs: SpyFS) {
        super(ppath);
      }

      mapToBase = jest.fn(p => p);
      mapFromBase = jest.fn(p => p);
    }

    {
      const spyFs = new SpyFS();
      const testFs = new TestFS(spyFs);

      const basePath = `/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y/z` as PortablePath;
      const linkPath = basePath.split(`/`).slice(2, -1).map(() => `..`).join(`/`) as PortablePath;

      testFs.symlinkSync(linkPath, basePath);

      expect(testFs.mapToBase).toHaveBeenCalledWith(basePath);
      expect(testFs.mapToBase).toHaveBeenCalledWith(`/a` as PortablePath);

      expect(spyFs.symlinkSync).toHaveBeenCalledWith(linkPath, basePath, undefined);
    }

    {
      const spyFs = new SpyFS();
      const testFs = new TestFS(spyFs);

      const basePath = `/a/b/c/d/e/f/g/h/i/j/k/l/m/n/o/p/q/r/s/t/u/v/w/x/y/z` as PortablePath;
      const linkPath = basePath.split(`/`).slice(2, -1).map(() => `..`).join(`/`) as PortablePath;

      await testFs.symlinkPromise(linkPath, basePath);

      expect(testFs.mapToBase).toHaveBeenCalledWith(basePath);
      expect(testFs.mapToBase).toHaveBeenCalledWith(`/a` as PortablePath);

      expect(spyFs.symlinkPromise).toHaveBeenCalledWith(linkPath, basePath, undefined);
    }
  });
});

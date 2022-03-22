import {Filename, PortablePath, ppath, xfs}  from '@yarnpkg/fslib';
import {RequestType, startRegistryRecording} from 'pkg-tests-core/sources/utils/tests';

export {};

describe(`Features`, () => {
  describe(`Pruned native deps`, () => {
    it(`should resolve all dependencies, regardless of the system`, makeTemporaryEnv({
      dependencies: {
        [`optional-native`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        supportedArchitectures: {
          cpu: [`foo`],
          os: [`x64`],
          libc: [`glibc`],
        },
      });

      await run(`install`);

      await expect(xfs.readFilePromise(ppath.join(path, Filename.lockfile), `utf8`)).resolves.toMatchSnapshot();
    }));

    it(`shouldn't fetch packages that it won't need`, makeTemporaryEnv({
      dependencies: {
        [`optional-native`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        supportedArchitectures: {
          os: [`foo`],
          cpu: [`x64`],
          libc: [`glibc`],
        },
      });

      const recording = await startRegistryRecording(async () => {
        await run(`install`);
      });

      const tarballRequests = recording.filter(request => {
        return request.type === RequestType.PackageTarball;
      }).sort((a, b) => {
        const aJson = JSON.stringify(a);
        const bJson = JSON.stringify(b);
        return aJson < bJson ? -1 : aJson > bJson ? 1 : 0;
      });

      expect(tarballRequests).toEqual([{
        type: RequestType.PackageTarball,
        localName: `native-foo-x64`,
        version: `1.0.0`,
      }, {
        type: RequestType.PackageTarball,
        localName: `native-libc-glibc`,
        version: `1.0.0`,
      }, {
        type: RequestType.PackageTarball,
        localName: `optional-native`,
        version: `1.0.0`,
      }]);
    }));

    it(`should overfetch if requested to do so`, makeTemporaryEnv({
      dependencies: {
        [`optional-native`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        supportedArchitectures: {
          os: [`foo`],
          cpu: [`x64`, `x86`],
          libc: [`glibc`, `musl`],
        },
      });

      const recording = await startRegistryRecording(async () => {
        await run(`install`);
      });

      const tarballRequests = recording.filter(request => {
        return request.type === RequestType.PackageTarball;
      }).sort((a, b) => {
        const aJson = JSON.stringify(a);
        const bJson = JSON.stringify(b);
        return aJson < bJson ? -1 : aJson > bJson ? 1 : 0;
      });

      expect(tarballRequests).toEqual([{
        type: RequestType.PackageTarball,
        localName: `native-foo-x64`,
        version: `1.0.0`,
      }, {
        type: RequestType.PackageTarball,
        localName: `native-foo-x86`,
        version: `1.0.0`,
      }, {
        type: RequestType.PackageTarball,
        localName: `native-libc-glibc`,
        version: `1.0.0`,
      }, {
        type: RequestType.PackageTarball,
        localName: `native-libc-musl`,
        version: `1.0.0`,
      }, {
        type: RequestType.PackageTarball,
        localName: `optional-native`,
        version: `1.0.0`,
      }]);
    }));

    it(`should produce a stable lockfile, regardless of the architecture`, makeTemporaryEnv({
      dependencies: {
        [`optional-native`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        supportedArchitectures: {
          os: [`foo`],
          cpu: [`x64`],
          libc: [`glibc`],
        },
      });

      await run(`install`);
      const lockfile64 = await xfs.readFilePromise(ppath.join(path, Filename.lockfile), `utf8`);

      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        supportedArchitectures: {
          os: [`bar`],
          cpu: [`x86`],
          libc: [`musl`],
        },
      });

      await run(`install`);
      const lockfile86 = await xfs.readFilePromise(ppath.join(path, Filename.lockfile), `utf8`);

      expect(lockfile86).toEqual(lockfile64);
    }));

    it(`should produce a stable PnP hook, regardless of the architecture`, makeTemporaryEnv({
      dependencies: {
        [`optional-native`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        supportedArchitectures: {
          os: [`foo`],
          cpu: [`x64`],
          libc: [`glibc`],
        },
      });

      await run(`install`);
      const hook64 = await xfs.readFilePromise(ppath.join(path, Filename.pnpCjs), `utf8`);

      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        supportedArchitectures: {
          os: [`bar`],
          cpu: [`x86`],
          libc: [`musl`],
        },
      });

      await run(`install`);
      const hook86 = await xfs.readFilePromise(ppath.join(path, Filename.pnpCjs), `utf8`);

      expect(hook86).toEqual(hook64);
    }));

    it(`shouldn't break when using --check-cache with native packages`, makeTemporaryEnv({
      dependencies: {
        [`optional-native`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        supportedArchitectures: {
          os: [`foo`],
          cpu: [`x64`],
          libc: [`glibc`],
        },
      });

      await run(`install`);

      const cacheFolder = ppath.join(path, `.yarn/cache` as PortablePath);
      const cacheListing = await xfs.readdirPromise(cacheFolder);
      const nativeFile = cacheListing.find(entry => entry.startsWith(`native-foo-x64-`));

      // Sanity check
      expect(nativeFile).toBeDefined();

      await run(`install`, `--check-cache`);
    }));

    it(`should detect packages being tampered when using --check-cache`, makeTemporaryEnv({
      dependencies: {
        [`optional-native`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        supportedArchitectures: {
          os: [`foo`],
          cpu: [`x64`],
          libc: [`glibc`],
        },
      });

      await run(`install`);

      const cacheFolder = ppath.join(path, `.yarn/cache` as PortablePath);
      const cacheListing = await xfs.readdirPromise(cacheFolder);
      const nativeFile = cacheListing.find(entry => entry.startsWith(`native-foo-x64-`));

      // Sanity check
      expect(nativeFile).toBeDefined();

      await xfs.appendFilePromise(ppath.join(cacheFolder, nativeFile as Filename), Buffer.from([0]));

      await expect(async () => {
        await run(`install`, `--check-cache`);
      }).rejects.toThrow();
    }));

    it(`should also validate other architectures than the current one if necessary when using --check-cache`, makeTemporaryEnv({
      dependencies: {
        [`optional-native`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        supportedArchitectures: {
          os: [`foo`],
          cpu: [`x64`, `x86`],
          libc: [`glibc`],
        },
      });

      await run(`install`);

      const cacheFolder = ppath.join(path, `.yarn/cache` as PortablePath);
      const cacheListing = await xfs.readdirPromise(cacheFolder);
      const nativeFile = cacheListing.find(entry => entry.startsWith(`native-foo-x64-`));

      // Sanity check
      expect(nativeFile).toBeDefined();

      await xfs.appendFilePromise(ppath.join(cacheFolder, nativeFile as Filename), Buffer.from([0]));

      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        supportedArchitectures: {
          os: [`foo`],
          cpu: [`x86`],
          libc: [`glibc`],
        },
      });

      await expect(async () => {
        await run(`install`, `--check-cache`);
      }).rejects.toThrow();
    }));

    it(`should only fetch other architectures when using --check-cache if they are already in the cache`, makeTemporaryEnv({
      dependencies: {
        [`optional-native`]: `1.0.0`,
      },
    }, async ({path, run, source}) => {
      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        supportedArchitectures: {
          os: [`foo`],
          cpu: [`x64`, `x86`],
          libc: [`glibc`],
        },
      });

      await run(`install`);

      await xfs.writeJsonPromise(ppath.join(path, Filename.rc), {
        supportedArchitectures: {
          os: [`foo`],
          cpu: [`x64`],
          libc: [`glibc`],
        },
      });

      const recording = await startRegistryRecording(async () => {
        await run(`install`, `--check-cache`);
      });

      const tarballRequests = recording.filter(request => {
        return request.type === RequestType.PackageTarball;
      }).sort((a, b) => {
        const aJson = JSON.stringify(a);
        const bJson = JSON.stringify(b);
        return aJson < bJson ? -1 : aJson > bJson ? 1 : 0;
      });

      expect(tarballRequests).toEqual([{
        type: RequestType.PackageTarball,
        localName: `native-foo-x64`,
        version: `1.0.0`,
      }, {
        type: RequestType.PackageTarball,
        localName: `native-foo-x86`,
        version: `1.0.0`,
      }, {
        type: RequestType.PackageTarball,
        localName: `native-libc-glibc`,
        version: `1.0.0`,
      }, {
        type: RequestType.PackageTarball,
        localName: `optional-native`,
        version: `1.0.0`,
      }]);
    }));
  });
});

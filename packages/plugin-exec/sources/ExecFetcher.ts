import {execUtils, scriptUtils, structUtils, tgzUtils}                     from '@yarnpkg/core';
import {Locator, MessageName}                                              from '@yarnpkg/core';
import {Fetcher, FetchOptions, MinimalFetchOptions}                        from '@yarnpkg/core';
import {Filename, PortablePath, npath, ppath, toFilename, xfs, NativePath} from '@yarnpkg/fslib';

import {PROTOCOL}                                                          from './constants';
import {loadGeneratorFile}                                                 from './execUtils';

/**
 * Contains various useful details about the execution context.
 */
export interface ExecEnv {
  /**
   * The absolute path of the empty temporary directory. It is created before the script is invoked.
   */
  tempDir: NativePath;
  /**
   * The absolute path of the empty build directory that will be compressed into an archive and stored within the cache. It is created before the script is invoked.
   */
  buildDir: NativePath;
  /**
   * The stringified Locator identifying the generator package.
   */
  locator: string;
}

export class ExecFetcher implements Fetcher {
  supports(locator: Locator, opts: MinimalFetchOptions) {
    if (!locator.reference.startsWith(PROTOCOL))
      return false;

    return true;
  }

  getLocalPath(locator: Locator, opts: FetchOptions) {
    const {parentLocator, path} = structUtils.parseFileStyleRange(locator.reference, {protocol: PROTOCOL});
    if (ppath.isAbsolute(path))
      return path;

    const parentLocalPath = opts.fetcher.getLocalPath(parentLocator, opts);
    if (parentLocalPath === null)
      return null;

    return ppath.resolve(parentLocalPath, path);
  }

  async fetch(locator: Locator, opts: FetchOptions) {
    const expectedChecksum = opts.checksums.get(locator.locatorHash) || null;

    const [packageFs, releaseFs, checksum] = await opts.cache.fetchPackageFromCache(
      locator,
      expectedChecksum,
      async () => {
        opts.report.reportInfoOnce(MessageName.FETCH_NOT_CACHED, `${structUtils.prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from the disk`);
        return await this.fetchFromDisk(locator, opts);
      },
    );

    return {
      packageFs,
      releaseFs,
      prefixPath: structUtils.getIdentVendorPath(locator),
      localPath: this.getLocalPath(locator, opts),
      checksum,
    };
  }

  private async fetchFromDisk(locator: Locator, opts: FetchOptions) {
    const generatorFile = await loadGeneratorFile(locator.reference, PROTOCOL, opts);

    return xfs.mktempPromise(async generatorDir => {
      const generatorPath = ppath.join(generatorDir, toFilename(`generator.js`));
      await xfs.writeFilePromise(generatorPath, generatorFile);

      return xfs.mktempPromise(async cwd => {
        // Execute the specified script in the temporary directory
        await this.generatePackage(cwd, locator, generatorPath, opts);

        // Make sure the script generated the package
        if (!xfs.existsSync(ppath.join(cwd, toFilename(`build`))))
          throw new Error(`The script should have generated a build directory`);

        return await tgzUtils.makeArchiveFromDirectory(ppath.join(cwd, toFilename(`build`)), {
          prefixPath: structUtils.getIdentVendorPath(locator),
          compressionLevel: opts.project.configuration.get('compressionLevel'),
        });
      });
    });
  }

  private async generatePackage(cwd: PortablePath, locator: Locator, generatorPath: PortablePath, opts: FetchOptions) {
    return await xfs.mktempPromise(async binFolder => {
      const env = await scriptUtils.makeScriptEnv({project: opts.project, binFolder});
      const envFile = ppath.join(cwd, `environment.js` as Filename);

      return await xfs.mktempPromise(async logDir => {
        const logFile = ppath.join(logDir, `buildfile.log` as Filename);

        const stdin = null;
        const stdout = xfs.createWriteStream(logFile);
        const stderr = stdout;

        const tempDir = ppath.join(cwd, `generator` as PortablePath);
        const buildDir = ppath.join(cwd, `build` as PortablePath);

        await xfs.mkdirPromise(tempDir);
        await xfs.mkdirPromise(buildDir);

        /**
         * Values exposed on the global `execEnv` variable.
         *
         * Must be stringifiable using `JSON.stringify`.
         */
        const execEnvValues: ExecEnv = {
          tempDir: npath.fromPortablePath(tempDir),
          buildDir: npath.fromPortablePath(buildDir),
          locator: structUtils.stringifyLocator(locator),
        };
        await xfs.writeFilePromise(envFile, `
          // Expose 'Module' as a global variable
          Object.defineProperty(global, 'Module', {
            get: () => require('module'),
            enumerable: false,
          });

          // Expose non-hidden built-in modules as global variables
          for (const name of Module.builtinModules.filter((name) => name !== 'module' && !name.startsWith('_'))) {
            Object.defineProperty(global, name, {
              get: () => require(name),
              enumerable: false,
            });
          }

          // Expose the 'execEnv' global variable
          Object.defineProperty(global, 'execEnv', {
            value: {
              ...${JSON.stringify(execEnvValues)},
            },
            enumerable: true,
          });
        `);
        const envRequire = `--require ${npath.fromPortablePath(envFile)}`;
        let NODE_OPTIONS = env.NODE_OPTIONS || ``;
        NODE_OPTIONS = NODE_OPTIONS ? `${NODE_OPTIONS} ${envRequire}` : envRequire;
        env.NODE_OPTIONS = NODE_OPTIONS;

        stdout.write(`# This file contains the result of Yarn generating a package (${structUtils.stringifyLocator(locator)})\n`);
        stdout.write(`\n`);

        const {code} = await execUtils.pipevp(process.execPath, [npath.fromPortablePath(generatorPath), structUtils.stringifyIdent(locator)], {cwd, env, stdin, stdout, stderr});
        if (code !== 0) {
          xfs.detachTemp(logDir);
          throw new Error(`Package generation failed (exit code ${code}, logs can be found here: ${logFile})`);
        }
      });
    });
  }
}

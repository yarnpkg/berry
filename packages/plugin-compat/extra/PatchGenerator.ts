import {miscUtils, tgzUtils}                                   from '@yarnpkg/core';
import {CwdFS, Filename, npath, ppath, xfs, type PortablePath} from '@yarnpkg/fslib';
import chalk                                                   from 'chalk';
import {tmpdir}                                                from 'node:os';
import {promisify}                                             from 'node:util';
import {brotliCompress}                                        from 'node:zlib';
import pLimit                                                  from 'p-limit';
import semver                                                  from 'semver';

import {logger, spawn}                                         from './utils';

export abstract class PatchGenerator<S extends {id: string, range: string}> {
  protected readonly tmp: PortablePath;
  protected readonly patches: PortablePath;
  protected noCache = process.env.GEN_PATCHES_NO_CACHE !== undefined;

  public constructor(
    public readonly name: string,
    protected readonly slices: Array<S>,
  ) {
    const base = process.env.GEN_PATCHES_BASE_DIR
      ? npath.toPortablePath(process.env.GEN_PATCHES_BASE_DIR)
      : ppath.join(npath.toPortablePath(tmpdir()), `yarn-compat-gen-patches`);

    this.tmp = ppath.join(base, this.name as Filename);
    this.patches = ppath.join(npath.toPortablePath(__dirname), this.name as Filename, `patches`);
  }

  /**
   * Given the path to the build cache directory, populate it by saving the
   * "before" state of the slice into `<path>/base` and the "after" state into
   * `<path>/patched`.
   *
   * The build cache directory is guaranteed to exist, but the `base` and
   * `patched` sub-directories are not.
   */
  protected abstract build(slice: S, path: PortablePath): Promise<void>;
  /**
   * Given a slice, return the list of package versions the generated patch
   * should be validated against.
   */
  protected abstract getValidateVersions(slice: S): Promise<Array<string>>;

  private async fetchTarball(version: string): Promise<Buffer> {
    // eslint-disable-next-line no-restricted-globals
    const response = await fetch(`https://registry.yarnpkg.com/${this.name}/-/${this.name}-${version}.tgz`);
    if (!response.ok)
      throw new Error(`Failed to fetch tarball for ${this.name}@${version} - ${response.status} ${response.statusText}`);
    if (!response.body)
      throw new Error(`Failed to fetch tarball for ${this.name}@${version} - Empty body`);

    return Buffer.from(await response.arrayBuffer());
  }
  /**
   * Return the tarball for the given version of the package with caching. If
   * not already cached, it will be fetched from the npm registry.
   */
  protected async getTarball(version: string): Promise<Buffer> {
    const path = ppath.join(this.tmp, `tarballs`, `${version}.tgz` as Filename);
    if (await xfs.existsPromise(path))
      return xfs.readFilePromise(path);

    const [tarball] = await Promise.all([
      this.fetchTarball(version),
      xfs.mkdirpPromise(ppath.dirname(path)),
    ]);

    await xfs.writeFilePromise(path, tarball);
    return tarball;
  }

  /**
   * Generate a unified diff between the `base` and `patched` sub-directories of
   * the given directory, with the custom semver exclusivity header.
   */
  protected async diff(range: string, dir: PortablePath): Promise<string> {
    const patch = await spawn(`git`, [
      `diff`,
      `--no-index`,
      `--abbrev=4`,
      `-U3`,
      `--diff-algorithm=minimal`,
      `--src-prefix=a/`,
      `--dst-prefix=b/`,
      `base`,
      `patched`,
    ], {
      cwd: npath.fromPortablePath(dir),
      env: {
        GIT_CONFIG_NOSYSTEM: `1`,
        HOME: ``,
        XDG_CONFIG_HOME: ``,
        USERPROFILE: ``,
      },
    }).output;

    return patch.toString()
      .replace(/^diff --git (?<src>.+) (?<dst>.+)\n(?<fields>(?:\w.+\n)+)--- (\1|\/dev\/null)\n\+\+\+ \2\n/gm, (_, src, dst, fields, src2) => {
        // It is possible to get "a/patched", specifically when the diff is creating a file
        const base = src.replace(/^("?a\/)(base|patched)\//, `$1`);
        const patched = dst.replace(/^("?b\/)patched\//, `$1`);
        return [
          `diff --git ${base} ${patched}`,
          fields.slice(0, -1),
          `semver exclusivity ${range}`,
          `--- ${src2 === `/dev/null` ? `/dev/null` : base}`,
          `+++ ${patched}`,
          ``,
        ].join(`\n`);
      });
  }

  /**
   * Create the patch for the given slice, reusing any existing cached patch or
   * build if available, and write it to disk if not already cached.
   */
  protected createPatch(slice: S): Promise<{path: PortablePath, content: string}> {
    return logger.section(`Create patch`, async () => {
      const path = ppath.join(this.patches, `patch-${slice.id}.diff` as Filename);

      if (await xfs.existsPromise(path)) {
        const originalContent = await xfs.readFilePromise(path, `utf8`);
        const updatedContent = originalContent.replace(/^semver exclusivity .*\n/gm, `semver exclusivity ${slice.range}\n`);
        if (originalContent !== updatedContent) {
          await xfs.writeFilePromise(path, updatedContent);
          logger.log(`> Reusing cached patch ${ppath.basename(path)} (range updated)`);
        } else {
          logger.log(`> Reusing cached patch ${ppath.basename(path)}`);
        }

        return {path, content: updatedContent};
      } else {
        const buildPath = ppath.join(this.tmp, `builds`, slice.id as Filename);
        const base = ppath.join(buildPath, `base`);
        const patched = ppath.join(buildPath, `patched`);

        if (await xfs.existsPromise(buildPath)) {
          await logger.section(`Build`, async () => logger.log(chalk.grey(`> Reusing cached builds`)));
        } else {
          await xfs.mkdirpPromise(buildPath);
          await this.build(slice, buildPath);
        }

        return await logger.section(`Generate diff`, async () => {
          logger.log(`--- ${npath.fromPortablePath(base)}`);
          logger.log(`+++ ${npath.fromPortablePath(patched)}`);
          const content = await this.diff(slice.range, buildPath);

          await xfs.writeFilePromise(path, content);
          return {path, content};
        });
      }
    });
  }

  private readonly envs = new Map<string, Promise<PortablePath>>();
  private async prepareValidationEnv(version: string): Promise<PortablePath> {
    const path = ppath.join(this.tmp, `validate`, version as Filename);
    const [tarball] = await Promise.all([
      this.getTarball(version),
      xfs.mkdirpPromise(path),
    ]);
    await tgzUtils.extractArchiveTo(tarball, new CwdFS(path), {stripComponents: 1});
    return path;
  }
  /**
   * Prepare the validation environment for the specified version by extracting
   * the package tarball into a temporary directory.
   */
  protected async getValidationEnv(version: string): Promise<PortablePath> {
    return miscUtils.getFactoryWithDefault(this.envs, version, () =>  this.prepareValidationEnv(version));
  }
  private async prepareAllValidationEnvs({signal}: {signal?: AbortSignal} = {}): Promise<void> {
    const limit = pLimit(5);

    const versions = await Promise.all(this.slices.map(slice => this.getValidateVersions(slice)));
    await Promise.all(versions.flat().map(version => limit(async () => {
      if (signal?.aborted)
        return null;

      return this.getValidationEnv(version);
    })));
  }
  /**
   * Validate that the given patch can be cleanly applied to the versions of the
   * package as selected by {@link getValidateVersions}.
   */
  protected validatePatch(slice: S, patch: string): Promise<void> {
    return logger.section(`Validate patch`, async () => {
      const versions = await this.getValidateVersions(slice);
      await Promise.all(versions.map(async version => {
        logger.log(`> ${version}`);
        const env = await this.getValidationEnv(version);

        const child = spawn(`git`, [`apply`, `--check`, `-`], {
          cwd: npath.fromPortablePath(env),
        });
        child.process.stdin!.write(patch.replace(/^semver exclusivity .*\n/gm, ``));
        child.process.stdin!.end();
        await child.success;
      }));
    });
  }

  /**
   * Create, write to disk, and validate the patch for the given slice.
   */
  protected async generatePatch(slice: S): Promise<string> {
    const clearBuildCache = () => xfs.removeSync(ppath.join(this.tmp, `builds`, slice.id as Filename));

    return await logger.section(`Generate patch ${slice.id} (${slice.range})`, async () => {
      // If process exits while creating a patch, or the created patch fails validation,
      // remove the build cache so as to not corrupt future builds
      process.once(`exit`, clearBuildCache);
      const {path, content} = await this.createPatch(slice);

      try {
        await this.validatePatch(slice, content);
      } catch (err) {
        // If a patch fails validation, reusing it in the future will most likely fail again
        // So force regeneration in the next run by removing the patch file (and the build cache)
        await xfs.removePromise(path);
        throw err;
      }

      process.off(`exit`, clearBuildCache);

      if (this.noCache) {
        await logger.section(`Clean cache`, async () => {
          const versions = await this.getValidateVersions(slice);
          await Promise.all([
            xfs.removePromise(ppath.join(this.tmp, `builds`, slice.id as Filename)),
            ...versions.map(version => xfs.removePromise(ppath.join(this.tmp, `validate`, version as Filename))),
            ...versions.map(version => xfs.removePromise(ppath.join(this.tmp, `tarballs`, `${version}.tgz`))),
          ]);
        });
      }

      return content;
    });
  }

  /**
   * Generate all patches and write the compressed TS bundle to the specified
   * path. If one or more ranges are specified, caches are not used for slices
   * whose range overlaps with any of the specified ranges.
   */
  public async generateBundle(ranges: Array<string>, path: PortablePath): Promise<void> {
    // Start preparing validation environments immediately
    const controller = new AbortController();
    const signal = controller.signal;
    // No await here to run preparation in parallel to builds, and prevent
    // unhandled rejections. The promises will be grabbed from the map and
    // awaited during validation, and errors will be handled then.
    void this.prepareAllValidationEnvs({signal}).catch(() => {});

    try {
      const patches = new Map<string, string>();

      if (ranges.length > 0) {
        const regenerate = ranges.join(` || `);

        // Do regeneration first because those slices are more likely to fail
        for (const slice of this.slices.filter(slice => semver.intersects(regenerate, slice.range, {includePrerelease: true}))) {
          // Force fresh build by clearing cached files
          await Promise.all([
            xfs.removePromise(ppath.join(this.patches, `patch-${slice.id}.diff` as Filename)),
            xfs.removePromise(ppath.join(this.tmp, `builds`, slice.id as Filename)),
          ]);

          patches.set(slice.id, await this.generatePatch(slice));
        }
      }

      for (const slice of this.slices) {
        if (!patches.has(slice.id)) {
          patches.set(slice.id, await this.generatePatch(slice));
        }
      }

      await logger.section(`Generate final patch bundle`, async () => {
        const aggregate = await promisify(brotliCompress)(this.slices.map(slice => patches.get(slice.id)).join(``));

        const bundle = Buffer.from([
          `let patch: string;`,
          ``,
          `export function getPatch() {`,
          `  if (typeof patch === \`undefined\`)`,
          `    patch = require(\`zlib\`).brotliDecompressSync(Buffer.from(\`${aggregate.toString(`base64`)}\`, \`base64\`)).toString();`,
          ``,
          `  return patch;`,
          `}`,
          ``,
        ].join(`\n`));

        await xfs.writeFilePromise(path, bundle);
      });

      await logger.section(`Prune caches`, async () => {
        if (this.noCache) {
          await xfs.removePromise(this.tmp);
          return;
        }

        const buildNames = new Set(this.slices.map(slice => slice.id as Filename));
        const patchNames = new Set(this.slices.map(slice => `patch-${slice.id}.diff` as Filename));

        // Use allSettled to avoid a race condition with the catch clause
        const results = await Promise.allSettled([
          xfs.removePromise(ppath.join(this.tmp, `validate`)),
          xfs.readdirPromise(this.patches).then(names => Promise.all(
            names.filter(name => !patchNames.has(name)).map(name => xfs.removePromise(ppath.join(this.patches, name))),
          )),
          xfs.existsPromise(ppath.join(this.tmp, `builds`)).then(async exists => {
            if (exists) {
              const names = await xfs.readdirPromise(ppath.join(this.tmp, `builds`));
              await Promise.all(
                names.filter(name => !buildNames.has(name)).map(name => xfs.removePromise(ppath.join(this.tmp, `builds`, name))),
              );
            }
          }),
        ]);

        const rejection = results.find(result => result.status === `rejected`);
        if (rejection !== undefined) {
          throw rejection.reason;
        }
      });
    } catch (err) {
      controller.abort();
      await xfs.removePromise(ppath.join(this.tmp, `validate`));
      throw err;
    }
  }
}

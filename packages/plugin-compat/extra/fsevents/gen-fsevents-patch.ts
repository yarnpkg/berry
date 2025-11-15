import {tgzUtils}                 from '@yarnpkg/core';
import type {PortablePath}        from '@yarnpkg/fslib';
import {CwdFS, npath, ppath, xfs} from '@yarnpkg/fslib';

import {PatchGenerator}           from '../PatchGenerator';
import {logger}                   from '../utils';

const SLICES = [
  {
    id: `1.2.11`,
    range: `^1`,
  },
  {
    id: `2.1.2`,
    range: `>=2.1 <2.2`,
  },
  {
    id: `2.2.0`,
    range: `^2.2`,
  },
];
type Slice = typeof SLICES[0];

class ResolvePatchGenerator extends PatchGenerator<Slice> {
  public constructor() {
    super(`fsevents`, SLICES);
    this.diffOpts = [`-U2`, `--full-index`];
  }
  protected async build(slice: Slice, path: PortablePath): Promise<void> {
    await logger.section(`Build`, async () => {
      const base = ppath.join(path, `base`);
      const patched = ppath.join(path, `patched`);

      const tarball = await this.getTarball(slice.id);
      await Promise.all([
        tgzUtils.extractArchiveTo(tarball, new CwdFS(base), {stripComponents: 1}),
        tgzUtils.extractArchiveTo(tarball, new CwdFS(patched), {stripComponents: 1}),
      ]);

      await Promise.all([
        xfs.copyFilePromise(
          ppath.join(npath.toPortablePath(__dirname), `fsevents-${slice.id}.js`),
          ppath.join(patched, `fsevents.js`),
        ),
        xfs.copyFilePromise(
          ppath.join(npath.toPortablePath(__dirname), `vfs.js`),
          ppath.join(patched, `vfs.js`),
        ),
      ]);
    });
  }
  protected async getValidateVersions(slice: Slice): Promise<Array<string>> {
    // At least smoke test for patch integrity
    return [slice.id];
  }
}

async function main() {
  const generator = new ResolvePatchGenerator();
  await generator.generateBundle(
    process.argv.slice(2),
    ppath.resolve(
      npath.toPortablePath(__dirname),
      `../../sources/patches/fsevents.patch.ts`,
    ),
  );
}

main().catch(err => {
  console.error();
  console.error(err.stack);
  process.exitCode = 1;
});

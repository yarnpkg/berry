import type {PortablePath}                from '@yarnpkg/fslib';
import {npath, NodeFS, ppath, CwdFS, xfs} from '@yarnpkg/fslib';

import {applyPatchFile}                   from '../sources/patchUtils';
import {parsePatchFile}                   from '../sources/tools/parse';

async function dirSnapshot(p: PortablePath) {
  const entries = await xfs.readdirPromise(p, {withFileTypes: true, recursive: true});
  return Object.fromEntries(
    await Promise.all(entries.map(async entry => {
      const rel = ppath.relative(p, ppath.join(entry.parentPath, entry.name));
      return [rel, entry.isDirectory() ? null : await xfs.readFilePromise(ppath.join(entry.parentPath, entry.name), `utf8`)];
    })),
  );
}

describe(`apply`,  () => {
  const fs = new NodeFS();
  const fixtures = ppath.join(npath.toPortablePath(__dirname), `fixtures`, `apply`);

  for (const iterator of fs.readdirSync(npath.toPortablePath(fixtures))) {
    it(`Applies patch for '${iterator}'`, async () => {
      const fixture = ppath.join(fixtures, iterator);

      const snapshot = await xfs.mktempPromise(async tmp => {
        await xfs.copyPromise(tmp, ppath.join(fixture, `a`));
        await applyPatchFile(
          parsePatchFile(await fs.readFilePromise(ppath.join(fixture, `patch.patch`), `utf8`)),
          {baseFs: new CwdFS(tmp)},
        );

        return await dirSnapshot(tmp);
      });

      expect(snapshot).toMatchObject(await dirSnapshot(ppath.join(fixture, `b`)));
    });
  }
});

import {Manifest, Plugin}   from '@berry/core';
import {structUtils}        from '@berry/core';
import {xfs}                from '@berry/fslib';
import {makeUpdater}        from '@berry/json-proxy';
// @ts-ignore
import {UsageError}         from '@manaflair/concierge';
import {basename}           from 'path';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`init`)
  .describe(`create a new package`)

  .action(async ({cwd}: {cwd: string}) => {
    if (xfs.existsSync(`${cwd}/package.json`))
      throw new UsageError(`A package.json already exists in the specified directory`);
    if (!xfs.existsSync(cwd))
      await xfs.mkdirpPromise(cwd);

    const updater = await makeUpdater(`${cwd}/package.json`);

    const manifest = new Manifest();
    manifest.name = structUtils.makeIdent(null, basename(cwd));

    updater.open((tracker: Object) => {
      manifest.exportTo(tracker);
    });

    await updater.save();
  });

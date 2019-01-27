import {Manifest, Plugin}   from '@berry/core';
import {structUtils}        from '@berry/core';
import {makeUpdater}        from '@berry/json-proxy';
// @ts-ignore
import {UsageError}         from '@manaflair/concierge';
import {mkdirp}             from 'fs-extra';
import {existsSync}         from 'fs';
import {basename}           from 'path';

export default (concierge: any, plugins: Map<string, Plugin>) => concierge

  .command(`init`)
  .describe(`create a new package`)

  .action(async ({cwd}: {cwd: string}) => {
    if (!existsSync(cwd))
      await mkdirp(cwd);

    if (existsSync(`${cwd}/package.json`))
      throw new UsageError(`A package.json already exists in the specified directory`);

    const updater = await makeUpdater(`${cwd}/package.json`);

    const manifest = new Manifest();
    manifest.name = structUtils.makeIdent(null, basename(cwd));

    updater.open((tracker: Object) => {
      manifest.exportTo(tracker);
    });

    await updater.save();
  });

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

  .detail(`
    This command will setup a new package in your local directory.

    Note that it currently is less powerful than the \`init\` command that was shipped with the v1 (in particular it doesn't support customizing the author), but it's mostly a case of us not having time to do everything. Implementing the missing features should be very simple, and would be a great way for you to contribute to a project used by millions of developers everyday. Please open a PR!
  `)

  .example(
    `Create a new package in the local directory`,
    `yarn init`,
  )

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

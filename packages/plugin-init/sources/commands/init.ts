import {Configuration, Manifest, PluginConfiguration} from '@berry/core';
import {structUtils}                                  from '@berry/core';
import {xfs}                                          from '@berry/fslib';
import {updateAndSave}                                from '@berry/json-proxy';
import {UsageError}                                   from 'clipanion';
import {posix}                                        from 'path';

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`init [-p,--private]`)
  .describe(`create a new package`)

  .detail(`
    This command will setup a new package in your local directory.

    If the \`-p,--private\` option is set, the package will be private by default.

    The following settings can be used in order to affect what the generated package.json will look like:

    - \`initLicense\`
    - \`initScope\`
    - \`initVersion\`
  `)

  .example(
    `Create a new package in the local directory`,
    `yarn init`,
  )

  .example(
    `Create a new private package in the local directory`,
    `yarn init -p`,
  )

  .action(async ({cwd, private: notPublic}: {cwd: string, private: boolean}) => {
    if (xfs.existsSync(`${cwd}/package.json`))
      throw new UsageError(`A package.json already exists in the specified directory`);

    if (!xfs.existsSync(cwd))
      await xfs.mkdirpPromise(cwd);

    const configuration = await Configuration.find(cwd, pluginConfiguration);

    const manifest = new Manifest();
    manifest.name = structUtils.makeIdent(configuration.get(`initScope`), posix.basename(cwd));
    manifest.version = configuration.get(`initVersion`);
    manifest.private = notPublic;
    manifest.license = configuration.get(`initLicense`);

    await updateAndSave(`${cwd}/package.json`, (tracker: Object) => {
      manifest.exportTo(tracker);
    });
  });

import {Configuration, Manifest, PluginConfiguration} from '@berry/core';
import {structUtils}                                  from '@berry/core';
import {xfs, PortablePath, ppath, toFilename}         from '@berry/fslib';
import {updateAndSave}                                from '@berry/json-proxy';
import {UsageError}                                   from 'clipanion';

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

  .action(async ({cwd, private: notPublic}: {cwd: PortablePath, private: boolean}) => {
    if (xfs.existsSync(ppath.join(cwd, toFilename(`package.json`))))
      throw new UsageError(`A package.json already exists in the specified directory`);

    if (!xfs.existsSync(cwd))
      await xfs.mkdirpPromise(cwd);

    const configuration = await Configuration.find(cwd, pluginConfiguration);

    const manifest = new Manifest();
    manifest.name = structUtils.makeIdent(configuration.get(`initScope`), ppath.basename(cwd));
    manifest.version = configuration.get(`initVersion`);
    manifest.private = notPublic;
    manifest.license = configuration.get(`initLicense`);

    await updateAndSave(ppath.join(cwd, toFilename(`package.json`)), (tracker: Object) => {
      manifest.exportTo(tracker);
    });
  });

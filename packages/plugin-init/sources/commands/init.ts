import {BaseCommand}             from '@yarnpkg/cli';
import {Configuration, Manifest} from '@yarnpkg/core';
import {structUtils}             from '@yarnpkg/core';
import {xfs, ppath, toFilename}  from '@yarnpkg/fslib';
import {updateAndSave}           from '@yarnpkg/json-proxy';
import {Command, UsageError}     from 'clipanion';

// eslint-disable-next-line arca/no-default-export
export default class InitCommand extends BaseCommand {
  @Command.Boolean(`-y,--yes`, {hidden: true})
  yes: boolean = false;

  @Command.Boolean(`-p,--private`)
  private: boolean = false;

  static usage = Command.Usage({
    description: `create a new package`,
    details: `
      This command will setup a new package in your local directory.

      If the \`-p,--private\` option is set, the package will be private by default.

      The following settings can be used in order to affect what the generated package.json will look like:

      - \`initLicense\`
      - \`initScope\`
      - \`initVersion\`
    `,
    examples: [[
      `Create a new package in the local directory`,
      `yarn init`,
    ], [
      `Create a new private package in the local directory`,
      `yarn init -p`,
    ]],
  });

  @Command.Path(`init`)
  async execute() {
    if (xfs.existsSync(ppath.join(this.context.cwd, toFilename(`package.json`))))
      throw new UsageError(`A package.json already exists in the specified directory`);

    if (!xfs.existsSync(this.context.cwd))
      await xfs.mkdirpPromise(this.context.cwd);

    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    const manifest = new Manifest();
    manifest.name = structUtils.makeIdent(configuration.get(`initScope`), ppath.basename(this.context.cwd));
    manifest.version = configuration.get(`initVersion`);
    manifest.private = this.private;
    manifest.license = configuration.get(`initLicense`);

    await updateAndSave(ppath.join(this.context.cwd, toFilename(`package.json`)), (tracker: Object) => {
      manifest.exportTo(tracker);
    });
  }
}

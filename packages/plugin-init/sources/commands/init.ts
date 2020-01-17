import {BaseCommand}                         from '@yarnpkg/cli';
import {Configuration, Manifest}             from '@yarnpkg/core';
import {execUtils, scriptUtils, structUtils} from '@yarnpkg/core';
import {xfs, ppath, Filename}                from '@yarnpkg/fslib';
import {Command, UsageError}                 from 'clipanion';
import {inspect}                             from 'util';

// eslint-disable-next-line arca/no-default-export
export default class InitCommand extends BaseCommand {
  @Command.Boolean(`-y,--yes`, {hidden: true})
  yes: boolean = false;

  @Command.Boolean(`-p,--private`)
  private: boolean = false;

  @Command.String(`-i,--install`)
  install?: string;

  static usage = Command.Usage({
    description: `create a new package`,
    details: `
      This command will setup a new package in your local directory.

      If the \`-p,--private\` option is set, the package will be private by default.

      If the \`-i,--install\` option is given a value, Yarn will first download it using \`yarn set version\` and only then forward the init call to the newly downloaded bundle.

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
    ], [
      `Create a new package and store the Yarn release inside`,
      `yarn init -i berry`,
    ]],
  });

  @Command.Path(`init`)
  async execute() {
    if (xfs.existsSync(ppath.join(this.context.cwd, Manifest.fileName)))
      throw new UsageError(`A package.json already exists in the specified directory`);

    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);

    if (typeof this.install !== `undefined`) {
      return await this.executeProxy(configuration);
    } else {
      return await this.executeRegular(configuration);
    }
  }

  async executeProxy(configuration: Configuration) {
    if (configuration.get(`yarnPath`) !== null)
      throw new UsageError(`Cannot use the --install flag when the current directory already uses yarnPath (from ${configuration.sources.get(`yarnPath`)})`);

    if (configuration.projectCwd !== null)
      throw new UsageError(`Cannot use the --install flag when the current directory is already part of a project`);

    if (!xfs.existsSync(this.context.cwd))
      await xfs.mkdirpPromise(this.context.cwd);

    const lockfilePath = ppath.join(this.context.cwd, configuration.get<Filename>(`lockfileFilename`));
    if (!xfs.existsSync(lockfilePath))
      await xfs.writeFilePromise(lockfilePath, ``);

    const versionExitCode = await this.cli.run([`set`, `version`, this.install!]);
    if (versionExitCode !== 0)
      return versionExitCode;

    this.context.stdout.write(`\n`);

    const args: Array<string> = [];
    if (this.private)
      args.push(`-p`);
    if (this.yes)
      args.push(`-y`);

    const {code} = await execUtils.pipevp(`yarn`, [`init`, ...args], {
      cwd: this.context.cwd,
      stdin: this.context.stdin,
      stdout: this.context.stdout,
      stderr: this.context.stderr,
      env: await scriptUtils.makeScriptEnv(),
    });

    return code;
  }

  async executeRegular(configuration: Configuration) {
    if (!xfs.existsSync(this.context.cwd))
      await xfs.mkdirpPromise(this.context.cwd);

    const manifest = new Manifest();
    manifest.name = structUtils.makeIdent(configuration.get(`initScope`), ppath.basename(this.context.cwd));
    manifest.version = configuration.get(`initVersion`);
    manifest.private = this.private;
    manifest.license = configuration.get(`initLicense`);

    const serialized: any = {};
    manifest.exportTo(serialized);

    inspect.styles.name = `cyan`;

    this.context.stdout.write(`${inspect(serialized, {
      depth: Infinity,
      colors: true,
      compact: false,
    })}\n`);

    const manifestPath = ppath.join(this.context.cwd, Manifest.fileName);
    await xfs.changeFilePromise(manifestPath, `${JSON.stringify(serialized, null, 2)}\n`);
  }
}

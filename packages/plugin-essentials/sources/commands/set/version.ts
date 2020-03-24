import {BaseCommand}                                               from '@yarnpkg/cli';
import {Configuration, Project, StreamReport, MessageName, Report} from '@yarnpkg/core';
import {execUtils, httpUtils, semverUtils}                         from '@yarnpkg/core';
import {Filename, PortablePath, ppath, xfs}                        from '@yarnpkg/fslib';
import {Command, Usage, UsageError}                                from 'clipanion';
import semver                                                      from 'semver';

// eslint-disable-next-line arca/no-default-export
export default class SetVersionCommand extends BaseCommand {
  @Command.String()
  version!: string;

  static usage: Usage = Command.Usage({
    description: `lock the Yarn version used by the project`,
    details: `
      This command will download a specific release of Yarn directly from the Yarn GitHub repository, will store it inside your project, and will change the \`yarnPath\` settings from your project \`.yarnrc.yml\` file to point to the new file.

      A very good use case for this command is to enforce the version of Yarn used by the any single member of your team inside a same project - by doing this you ensure that you have control on Yarn upgrades and downgrades (including on your deployment servers), and get rid of most of the headaches related to someone using a slightly different version and getting a different behavior than you.
    `,
    examples: [[
      `Download the latest release from the Yarn repository`,
      `$0 set version latest`,
    ], [
      `Download a specific Yarn 2 build`,
      `$0 set version 2.0.0-rc.30`,
    ], [
      `Switch back to a specific Yarn 1 release`,
      `$0 set version 1.22.1`,
    ]],
  });

  @Command.Path(`set`, `version`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);

    let bundleUrl: string;

    if (this.version === `latest`)
      bundleUrl = `https://github.com/yarnpkg/berry/raw/master/packages/yarnpkg-cli/bin/yarn.js`;
    else if (semverUtils.satisfiesWithPrereleases(this.version, `>=2.0.0`))
      bundleUrl = `https://github.com/yarnpkg/berry/raw/%40yarnpkg/cli/${this.version}/packages/yarnpkg-cli/bin/yarn.js`;
    else if (semverUtils.satisfiesWithPrereleases(this.version, `^0.x || ^1.x`))
      bundleUrl = `https://github.com/yarnpkg/yarn/releases/download/v${this.version}/yarn-${this.version}.js`;
    else if (semver.validRange(this.version))
      throw new UsageError(`Support for ranges got removed - please use the exact version you want to install, or 'latest' to get the latest build available`);
    else
      throw new UsageError(`Invalid version descriptor "${this.version}"`);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async (report: StreamReport) => {
      report.reportInfo(MessageName.UNNAMED, `Downloading ${configuration.format(bundleUrl, `green`)}`);
      const bundleBuffer = await httpUtils.get(bundleUrl, {configuration});

      await setVersion(project, null, bundleBuffer, {report});
    });

    return report.exitCode();
  }
}

type FetchReleasesOptions = {
  includePrereleases: boolean,
};

export async function setVersion(project: Project, bundleVersion: string | null, bundleBuffer: Buffer, {report}: {report: Report}) {
  if (bundleVersion === null) {
    await xfs.mktempPromise(async tmpDir => {
      const temporaryPath = ppath.join(tmpDir, `yarn.js` as Filename);
      await xfs.writeFilePromise(temporaryPath, bundleBuffer);

      const {stdout} = await execUtils.execvp(process.execPath, [temporaryPath, `--version`], {
        cwd: project.cwd,
        env: {...process.env, YARN_IGNORE_PATH: `1`},
      });

      bundleVersion = stdout.trim();
      if (!semver.valid(bundleVersion)) {
        throw new Error(`Invalid semver version`);
      }
    });
  }

  const releaseFolder = ppath.resolve(project.cwd, `.yarn/releases` as PortablePath);
  const absolutePath = ppath.resolve(releaseFolder, `yarn-${bundleVersion}.js` as Filename);

  const displayPath = ppath.relative(project.configuration.startingCwd, absolutePath);
  const projectPath = ppath.relative(project.cwd, absolutePath);

  const yarnPath = project.configuration.get(`yarnPath`);
  const updateConfig = yarnPath === null || yarnPath.startsWith(`${releaseFolder}/`);

  report.reportInfo(MessageName.UNNAMED, `Saving the new release in ${project.configuration.format(displayPath, `magenta`)}`);

  await xfs.removePromise(ppath.dirname(absolutePath));
  await xfs.mkdirpPromise(ppath.dirname(absolutePath));

  await xfs.writeFilePromise(absolutePath, bundleBuffer);
  await xfs.chmodPromise(absolutePath, 0o755);

  if (updateConfig) {
    await Configuration.updateConfiguration(project.cwd, {
      yarnPath: projectPath,
    });
  }
}

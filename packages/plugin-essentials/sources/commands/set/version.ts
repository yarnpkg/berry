import {BaseCommand}                                                                         from '@yarnpkg/cli';
import {Configuration, StreamReport, MessageName, Report, Manifest, FormatType, YarnVersion} from '@yarnpkg/core';
import {execUtils, formatUtils, httpUtils, miscUtils, semverUtils}                           from '@yarnpkg/core';
import {Filename, PortablePath, ppath, xfs, npath}                                           from '@yarnpkg/fslib';
import {Command, Option, Usage, UsageError}                                                  from 'clipanion';
import semver                                                                                from 'semver';

export type Tags = {
  latest: Record<string, string>;
  tags: Array<string>;
};

// eslint-disable-next-line arca/no-default-export
export default class SetVersionCommand extends BaseCommand {
  static paths = [
    [`set`, `version`],
  ];

  static usage: Usage = Command.Usage({
    description: `lock the Yarn version used by the project`,
    details: `
      This command will download a specific release of Yarn directly from the Yarn GitHub repository, will store it inside your project, and will change the \`yarnPath\` settings from your project \`.yarnrc.yml\` file to point to the new file.

      A very good use case for this command is to enforce the version of Yarn used by the any single member of your team inside a same project - by doing this you ensure that you have control on Yarn upgrades and downgrades (including on your deployment servers), and get rid of most of the headaches related to someone using a slightly different version and getting a different behavior than you.

      The version specifier can be:

      - a tag:
        - \`latest\` / \`berry\` / \`stable\` -> the most recent stable berry (\`>=2.0.0\`) release
        - \`canary\` -> the most recent canary (release candidate) berry (\`>=2.0.0\`) release
        - \`classic\` -> the most recent classic (\`^0.x || ^1.x\`) release

      - a semver range (e.g. \`2.x\`) -> the most recent version satisfying the range (limited to berry releases)

      - a semver version (e.g. \`2.4.1\`, \`1.22.1\`)

      - a local file referenced through either a relative or absolute path

      - \`self\` -> the version used to invoke the command
    `,
    examples: [[
      `Download the latest release from the Yarn repository`,
      `$0 set version latest`,
    ], [
      `Download the latest canary release from the Yarn repository`,
      `$0 set version canary`,
    ], [
      `Download the latest classic release from the Yarn repository`,
      `$0 set version classic`,
    ], [
      `Download the most recent Yarn 3 build`,
      `$0 set version 3.x`,
    ], [
      `Download a specific Yarn 2 build`,
      `$0 set version 2.0.0-rc.30`,
    ], [
      `Switch back to a specific Yarn 1 release`,
      `$0 set version 1.22.1`,
    ], [
      `Use a release from the local filesystem`,
      `$0 set version ./yarn.cjs`,
    ], [
      `Download the version used to invoke the command`,
      `$0 set version self`,
    ]],
  });

  onlyIfNeeded = Option.Boolean(`--only-if-needed`, false, {
    description: `Only lock the Yarn version if it isn't already locked`,
  });

  version = Option.String();

  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    if (configuration.get(`yarnPath`) && this.onlyIfNeeded)
      return 0;

    const getBundlePath = () => {
      if (typeof YarnVersion === `undefined`)
        throw new UsageError(`The --install flag can only be used without explicit version specifier from the Yarn CLI`);

      return `file://${process.argv[1]}`;
    };

    let bundleUrl: string;
    if (this.version === `self`)
      bundleUrl = getBundlePath();
    else if (this.version === `latest` || this.version === `berry` || this.version === `stable`)
      bundleUrl = `https://repo.yarnpkg.com/${await resolveTag(configuration, `stable`)}/packages/yarnpkg-cli/bin/yarn.js`;
    else if (this.version === `canary`)
      bundleUrl = `https://repo.yarnpkg.com/${await resolveTag(configuration, `canary`)}/packages/yarnpkg-cli/bin/yarn.js`;
    else if (this.version === `classic`)
      bundleUrl = `https://nightly.yarnpkg.com/latest.js`;
    else if (this.version.match(/^\.{0,2}[\\/]/) || npath.isAbsolute(this.version))
      bundleUrl = `file://${npath.resolve(this.version)}`;
    else if (semverUtils.satisfiesWithPrereleases(this.version, `>=2.0.0`))
      bundleUrl = `https://repo.yarnpkg.com/${this.version}/packages/yarnpkg-cli/bin/yarn.js`;
    else if (semverUtils.satisfiesWithPrereleases(this.version, `^0.x || ^1.x`))
      bundleUrl = `https://github.com/yarnpkg/yarn/releases/download/v${this.version}/yarn-${this.version}.js`;
    else if (semverUtils.validRange(this.version))
      bundleUrl = `https://repo.yarnpkg.com/${await resolveRange(configuration, this.version)}/packages/yarnpkg-cli/bin/yarn.js`;
    else
      throw new UsageError(`Invalid version descriptor "${this.version}"`);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
      includeLogs: !this.context.quiet,
    }, async (report: StreamReport) => {
      const filePrefix = `file://`;

      let bundleBuffer: Buffer;
      if (bundleUrl.startsWith(filePrefix)) {
        report.reportInfo(MessageName.UNNAMED, `Downloading ${formatUtils.pretty(configuration, bundleUrl, FormatType.URL)}`);
        bundleBuffer = await xfs.readFilePromise(npath.toPortablePath(bundleUrl.slice(filePrefix.length)));
      } else {
        report.reportInfo(MessageName.UNNAMED, `Retrieving ${formatUtils.pretty(configuration, bundleUrl, FormatType.PATH)}`);
        bundleBuffer = await httpUtils.get(bundleUrl, {configuration});
      }

      await setVersion(configuration, null, bundleBuffer, {report});
    });

    return report.exitCode();
  }
}

export async function resolveRange(configuration: Configuration, request: string) {
  const data: Tags = await httpUtils.get(`https://repo.yarnpkg.com/tags`, {configuration, jsonResponse: true});

  const candidates = data.tags.filter(version => semverUtils.satisfiesWithPrereleases(version, request));
  if (candidates.length === 0)
    throw new UsageError(`No matching release found for range ${formatUtils.pretty(configuration, request, formatUtils.Type.RANGE)}.`);

  // The tags on the website are sorted by semver descending
  return candidates[0];
}

export async function resolveTag(configuration: Configuration, request: `stable` | `canary`) {
  const data: Tags = await httpUtils.get(`https://repo.yarnpkg.com/tags`, {configuration, jsonResponse: true});
  if (!data.latest[request])
    throw new UsageError(`Tag ${formatUtils.pretty(configuration, request, formatUtils.Type.RANGE)} not found`);

  return data.latest[request];
}

export async function setVersion(configuration: Configuration, bundleVersion: string | null, bundleBuffer: Buffer, {report}: {report: Report}) {
  if (bundleVersion === null) {
    await xfs.mktempPromise(async tmpDir => {
      const temporaryPath = ppath.join(tmpDir, `yarn.cjs` as Filename);
      await xfs.writeFilePromise(temporaryPath, bundleBuffer);

      const {stdout} = await execUtils.execvp(process.execPath, [npath.fromPortablePath(temporaryPath), `--version`], {
        cwd: tmpDir,
        env: {...process.env, YARN_IGNORE_PATH: `1`},
      });

      bundleVersion = stdout.trim();
      if (!semver.valid(bundleVersion)) {
        throw new Error(`Invalid semver version. ${formatUtils.pretty(configuration, `yarn --version`, formatUtils.Type.CODE)} returned:\n${bundleVersion}`);
      }
    });
  }

  const projectCwd = configuration.projectCwd ?? configuration.startingCwd;

  const releaseFolder = ppath.resolve(projectCwd, `.yarn/releases` as PortablePath);
  const absolutePath = ppath.resolve(releaseFolder, `yarn-${bundleVersion}.cjs` as Filename);

  const displayPath = ppath.relative(configuration.startingCwd, absolutePath);
  const projectPath = ppath.relative(projectCwd, absolutePath);

  const yarnPath = configuration.get(`yarnPath`);
  const updateConfig = yarnPath === null || yarnPath.startsWith(`${releaseFolder}/`);

  report.reportInfo(MessageName.UNNAMED, `Saving the new release in ${formatUtils.pretty(configuration, displayPath, `magenta`)}`);

  await xfs.removePromise(ppath.dirname(absolutePath));
  await xfs.mkdirPromise(ppath.dirname(absolutePath), {recursive: true});

  await xfs.writeFilePromise(absolutePath, bundleBuffer, {mode: 0o755});

  if (updateConfig) {
    await Configuration.updateConfiguration(projectCwd, {
      yarnPath: projectPath,
    });

    const manifest = (await Manifest.tryFind(projectCwd)) || new Manifest();

    manifest.packageManager = `yarn@${
      bundleVersion && miscUtils.isTaggedYarnVersion(bundleVersion)
        ? bundleVersion
        // If the version isn't tagged, we use the latest stable version as the wrapper
        : await resolveTag(configuration, `stable`)
    }`;

    const data = {};
    manifest.exportTo(data);

    const path = ppath.join(projectCwd, Manifest.fileName);
    const content = `${JSON.stringify(data, null, manifest.indent)}\n`;

    await xfs.changeFilePromise(path, content, {
      automaticNewlines: true,
    });
  }
}

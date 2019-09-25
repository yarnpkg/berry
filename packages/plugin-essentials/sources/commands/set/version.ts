import {BaseCommand}                                               from '@yarnpkg/cli';
import {Configuration, Project, StreamReport, MessageName, Report} from '@yarnpkg/core';
import {httpUtils}                                                 from '@yarnpkg/core';
import {xfs, PortablePath, ppath}                                  from '@yarnpkg/fslib';
import {Command, UsageError}                                       from 'clipanion';
import semver, {SemVer}                                            from 'semver';

const BUNDLE_REGEXP = /^yarn-[0-9]+\.[0-9]+\.[0-9]+\.js$/;
const BERRY_RANGES = new Set([`berry`, `nightly`, `nightlies`, `rc`]);

// eslint-disable-next-line arca/no-default-export
export default class SetVersionCommand extends BaseCommand {
  @Command.String()
  range!: string;

  @Command.Boolean(`--allow-rc`)
  includePrereleases: boolean = false;

  @Command.Boolean(`--dry-run`)
  dryRun: boolean = false;

  static usage = Command.Usage({
    description: `lock the Yarn version used by the project`,
    details: `
      This command will download a specific release of Yarn directly from the Yarn Github repository, will store it inside your project, and will change the \`yarnPath\` settings from your project \`.yarnrc.yml\` file to point to the new file.

      A very good use case for this command is to enforce the version of Yarn used by the any single member of your team inside a same project - by doing this you ensure that you have control on Yarn upgrades and downgrades (including on your deployment servers), and get rid of most of the headaches related to someone using a slightly different version and getting a different behavior than you.

      The command will by default only consider stable releases as valid candidates, but releases candidates can be downloaded as well provided you add the \`--allow-rc\` flag or use an exact tag.

      Note that because you're on the v2 alpha trunk, running the command without parameter will always download the latest build straight from the repository. This behavior will be tweaked near the release to only download stable releases once more.

      Adding the \`--dry-run\` flag will cause Yarn not to persist the changes on the disk.
    `,
    examples: [[
      `Download the latest release from the Yarn repository`,
      `$0 set version latest`,
    ], [
      `Download the latest nightly release from the Yarn repository`,
      `$0 set version nightly`,
    ], [
      `Switch back to Yarn v1`,
      `$0 set version ^1`,
    ], [
      `Switch back to a specific release`,
      `$0 set version 1.14.0`,
    ]],
  });

  @Command.Path(`set`, `version`)
  async execute() {
    const configuration = await Configuration.find(this.context.cwd, this.context.plugins);
    const {project} = await Project.find(configuration, this.context.cwd);

    const report = await StreamReport.start({
      configuration,
      stdout: this.context.stdout,
    }, async (report: StreamReport) => {
      if (this.range === `latest`)
        this.range = `*`;

      let candidates: Array<string> = [];

      let bundleUrl: string;
      let bundleVersion: string;

      if (BERRY_RANGES.has(this.range)) {
        bundleUrl = `https://github.com/yarnpkg/berry/raw/master/packages/yarnpkg-cli/bin/yarn.js`;
        bundleVersion = `rc`;
        candidates = [bundleVersion];
      } else if (this.range === `nightly-v1`) {
        bundleUrl = `https://nightly.yarnpkg.com/latest.js`;
        bundleVersion = `classic`;
        candidates = [bundleVersion];
      } else if (semver.valid(this.range)) {
        const {releases} = await fetchReleases(configuration, {
          includePrereleases: true,
        });

        const release = releases.find(release => semver.eq(release.version, this.range));
        if (!release)
          throw new Error(`No matching release found for version ${this.range}.`);

        const asset = getBundleAsset(release);
        if (!asset)
          throw new Error(`Assertion failed: The bundle asset should exist`);

        bundleUrl = asset.browser_download_url;
        bundleVersion = release.version.version;
        candidates = [bundleVersion];
      } else if (semver.validRange(this.range)) {
        const {releases, prereleases} = await fetchReleases(configuration, {
          includePrereleases: this.includePrereleases,
        });

        const satisfying = releases.filter(release => semver.satisfies(release.version, this.range)).sort((a, b) => {
          return semver.rcompare(a.version, b.version);
        });

        if (satisfying.length === 0) {
          if (prereleases.find(release => semver.satisfies(release.version, this.range))) {
            throw new Error(`No matching release found for range ${this.range}, but a candidate prerelease was found - run with --allow-rc to use it.`);
          } else {
            throw new Error(`No matching release found for range ${this.range}.`);
          }
        }

        const release = satisfying[0];
        const asset = getBundleAsset(release);
        if (!asset)
          throw new Error(`Assertion failed: The bundle asset should exist`);

        bundleUrl = asset.browser_download_url;
        bundleVersion = release.version.version;
        candidates = satisfying.map(release => release.version.version);
      } else {
        throw new UsageError(`Invalid version descriptor "${this.range}"`);
      }

      if (candidates.length === 1)
        report.reportInfo(MessageName.UNNAMED, `Found matching release with ${configuration.format(bundleVersion, `#87afff`)}`);
      else
        report.reportInfo(MessageName.UNNAMED, `Selecting the highest release amongst ${configuration.format(bundleVersion, `#87afff`)} and ${candidates.length - 1} other${candidates.length === 2 ? `` : `s`}`);


      if (!this.dryRun) {
        report.reportInfo(MessageName.UNNAMED, `Downloading ${configuration.format(bundleUrl, `green`)}`);
        const bundleBuffer = await httpUtils.get(bundleUrl, {configuration});

        await setVersion(project, bundleVersion, bundleBuffer, {report});
      }
    });

    return report.exitCode();
  }
}

type ReleaseAsset = {
  id: any,

  name: string,
  browser_download_url: string,
};

type Release = {
  id: any,

  draft: boolean,
  prerelease: boolean,

  tag_name: string,
  version: SemVer,

  assets: Array<ReleaseAsset>,
};

function getBundleAsset(release: Release): ReleaseAsset | undefined {
  return release.assets.find(asset => {
    return BUNDLE_REGEXP.test(asset.name);
  });
}

type FetchReleasesOptions = {
  includePrereleases: boolean,
};

export async function fetchReleases(configuration: Configuration, {includePrereleases = false}: Partial<FetchReleasesOptions> = {}): Promise<{releases: Array<Release>, prereleases: Array<Release>}> {
  const request = await httpUtils.get(`https://api.github.com/repos/yarnpkg/yarn/releases`, {configuration});
  const apiData = (JSON.parse(request.toString()) as Array<Release>);

  const allReleases = apiData.filter(release => {
    if (release.draft)
      return false;

    const coercedVersion = semver.coerce(release.tag_name);
    if (!coercedVersion)
      return false;

    release.version = coercedVersion;

    if (!getBundleAsset(release))
      return false;

    return true;
  });

  allReleases.sort((a, b) => {
    return -semver.compare(a.version, b.version);
  });

  const prereleases = allReleases.filter(release => {
    return release.prerelease;
  });

  const releases = includePrereleases ? allReleases : allReleases.filter(release => {
    return !release.prerelease;
  });

  return {releases, prereleases};
}

export async function setVersion(project: Project, bundleVersion: string, bundleBuffer: Buffer, {report}: {report: Report}) {
  const relativePath = `.yarn/releases/yarn-${bundleVersion}.js` as PortablePath;
  const absolutePath = ppath.resolve(project.cwd, relativePath);

  report.reportInfo(MessageName.UNNAMED, `Saving the new release in ${project.configuration.format(relativePath, `magenta`)}`);
  await xfs.mkdirpPromise(ppath.dirname(absolutePath));
  await xfs.writeFilePromise(absolutePath, bundleBuffer);
  await xfs.chmodPromise(absolutePath, 0o755);

  await Configuration.updateConfiguration(project.cwd, {
    yarnPath: relativePath,
  });
}

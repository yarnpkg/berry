import {Configuration, PluginConfiguration, Project, StreamReport, MessageName} from '@berry/core';
import {httpUtils}                                                              from '@berry/core';
import {xfs, PortablePath, ppath}                                                                    from '@berry/fslib';
import semver, {SemVer}                                                         from 'semver';
import {Readable, Writable}                                                     from 'stream';
import * as yup                                                                 from 'yup';

const BUNDLE_REGEXP = /^yarn-[0-9]+\.[0-9]+\.[0-9]+\.js$/;
const BERRY_RANGES = new Set([`berry`, `v2`, `2`, `nightly`, `nightlies`, `rc`]);

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`set version <range> [--allow-rc] [--dry-run]`)
  .describe(`lock the Yarn version used by the project`)

  .aliases(`policies set-version`)

  .validate(yup.object().shape({
    range: yup.string().default(`berry`),
  }))

  .detail(`
    This command will download a specific release of Yarn directly from the Yarn Github repository, will store it inside your project, and will change the \`yarn-path\` settings from your project \`.yarnrc\` file to point to the new file.

    A very good use case for this command is to enforce the version of Yarn used by the any single member of your team inside a same project - by doing this you ensure that you have control on Yarn upgrades and downgrades (including on your deployment servers), and get rid of most of the headaches related to someone using a slightly different version and getting a different behavior than you.

    The command will by default only consider stable releases as valid candidates, but releases candidates can be downloaded as well provided you add the \`--allow-rc\` flag or use an exact tag.

    Note that because you're on the v2 alpha trunk, running the command without parameter will always download the latest build straight from the repository. This behavior will be tweaked near the release to only download stable releases once more.

    Adding the \`--dry-run\` flag will cause Yarn not to persist the changes on the disk.
  `)

  .example(
    `Download the latest release from the Yarn repository`,
    `yarn set version latest`,
  )

  .example(
    `Download the latest nightly release from the Yarn repository`,
    `yarn set version nightly`,
  )

  .example(
    `Switch back to Yarn v1`,
    `yarn set version ^1`,
  )

  .example(
    `Switch back to a specific release`,
    `yarn set version 1.14.0`,
  )

  .action(async ({cwd, stdout, range, allowRc, dryRun}: {cwd: PortablePath, stdin: Readable, stdout: Writable, range: string, allowRc: boolean, dryRun: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project} = await Project.find(configuration, cwd);

    const report = await StreamReport.start({configuration, stdout}, async (report: StreamReport) => {
      if (range === `latest`)
        range = `*`;

      let candidates = [];

      let bundleUrl;
      let bundleVersion;

      if (BERRY_RANGES.has(range)) {
        bundleUrl = `https://github.com/yarnpkg/berry/raw/master/packages/berry-cli/bin/berry.js`;
        bundleVersion = `berry`;
        candidates = [bundleVersion];
      } else if (range === `nightly-v1`) {
        bundleUrl = `https://nightly.yarnpkg.com/latest.js`;
        bundleVersion = `nightly`;
        candidates = [bundleVersion];
      } else if (semver.valid(range)) {
        const {releases} = await fetchReleases(configuration, {
          includePrereleases: true,
        });

        const release = releases.find(release => semver.eq(release.version, range));
        if (!release)
          throw new Error(`No matching release found for version ${range}.`);

        const asset = getBundleAsset(release);
        if (!asset)
          throw new Error(`Assertion failed: The bundle asset should exist`);

        bundleUrl = asset.browser_download_url;
        bundleVersion = release.version.version;
        candidates = [bundleVersion];
      } else {
        const {releases, prereleases} = await fetchReleases(configuration, {
          includePrereleases: allowRc,
        });

        const satisfying = releases.filter(release => semver.satisfies(release.version, range)).sort((a, b) => {
          return semver.rcompare(a.version, b.version);
        });

        if (satisfying.length === 0) {
          if (prereleases.find(release => semver.satisfies(release.version, range))) {
            throw new Error(`No matching release found for range ${range}, but a candidate prerelease was found - run with --allow-rc to use it.`);
          } else {
            throw new Error(`No matching release found for range ${range}.`);
          }
        }

        const release = satisfying[0];
        const asset = getBundleAsset(release);
        if (!asset)
          throw new Error(`Assertion failed: The bundle asset should exist`);

        bundleUrl = asset.browser_download_url;
        bundleVersion = release.version.version;
        candidates = satisfying.map(release => release.version.version);
      }

      if (candidates.length === 1) {
        report.reportInfo(MessageName.UNNAMED, `Found matching release with ${configuration.format(bundleVersion, `#87afff`)}`);
      } else {
        report.reportInfo(MessageName.UNNAMED, `Selecting the highest release amongst ${configuration.format(bundleVersion, `#87afff`)} and ${candidates.length - 1} other${candidates.length === 2 ? `` : `s`}`);
      }

      if (!dryRun) {
        report.reportInfo(MessageName.UNNAMED, `Downloading ${configuration.format(bundleUrl, `green`)}`);
        const releaseBuffer = await httpUtils.get(bundleUrl, {configuration});

        const relativePath = `.yarn/releases/yarn-${bundleVersion}.js` as PortablePath;
        const absolutePath = ppath.resolve(project.cwd, relativePath);

        report.reportInfo(MessageName.UNNAMED, `Saving the new release in ${configuration.format(relativePath, `magenta`)}`);
        await xfs.mkdirpPromise(ppath.dirname(absolutePath));
        await xfs.writeFilePromise(absolutePath, releaseBuffer);
        await xfs.chmodPromise(absolutePath, 0o755);

        await Configuration.updateConfiguration(project.cwd, {
          yarnPath: relativePath,
        });
      }
    });

    return report.exitCode();
  });

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

async function fetchReleases(configuration: Configuration, {includePrereleases = false}: Partial<FetchReleasesOptions> = {}): Promise<{releases: Array<Release>, prereleases: Array<Release>}> {
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

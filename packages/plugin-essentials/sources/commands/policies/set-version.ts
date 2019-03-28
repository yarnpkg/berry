import {Configuration, PluginConfiguration, Project} from '@berry/core';
import {httpUtils}                                   from '@berry/core';
import {xfs}                                         from '@berry/fslib';
import {posix}                                       from 'path';
import semver, {SemVer}                              from 'semver';
import {Readable, Writable}                          from 'stream';
import * as yup                                      from 'yup';

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

const BUNDLE_REGEXP = /^yarn-[0-9]+\.[0-9]+\.[0-9]+\.js$/;

function getBundleAsset(release: Release): ReleaseAsset | undefined {
  return release.assets.find(asset => {
    return BUNDLE_REGEXP.test(asset.name);
  });
}

type FetchReleasesOptions = {
  includePrereleases: boolean,
};

async function fetchReleases(configuration: Configuration, {includePrereleases = false}: Partial<FetchReleasesOptions> = {}): Promise<Array<Release>> {
  const request = await httpUtils.get(`https://api.github.com/repos/yarnpkg/yarn/releases`, configuration);
  const apiData = (JSON.parse(request.toString()) as Array<Release>);

  const releases = apiData.filter(release => {
    if (release.draft) {
      return false;
    }

    if (release.prerelease && !includePrereleases) {
      return false;
    }

    const coercedVersion = semver.coerce(release.tag_name);

    if (!coercedVersion) {
      return false;
    }

    release.version = coercedVersion;

    if (!getBundleAsset(release)) {
      return false;
    }

    return true;
  });

  releases.sort((a, b) => {
    return -semver.compare(a.version, b.version);
  });

  return releases;
}

export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`policies set-version [range]`)

  .categorize(`Policies-related commands`)
  .describe(`lock the version of Berry used in the project`)

  .validate(yup.object().shape({
    range: yup.string().default(`latest`),
  }))

  .detail(`
    This command will download a specific release of Yarn directly from the Yarn Github repository, will store it inside your project, and will change the \`yarn-path\` settings from your project .yarnrc to point to the new file.

    A very good use case for this command is to enforce the version of Yarn used by the any single member of your team inside a same project - by doing this you ensure that you have control on Yarn upgrades and downgrades (including on your deployment servers), and get rid of most of the headaches related to someone using a slightly different version and getting a different behavior than you.

    Important: because you're currently using Yarn v2 (which is still in developer preview stage), running this command will by default download the latest nightly from the Github repository. Once the v2 will have stabilized running this command will instead fetch the latest stable release. Regardless of this, using the \`nightly\` range will always fetch the latest nightlies from the repository.
  `)

  .example(
    `Downloads the latest release from the Yarn repository`,
    `yarn policies set-version`,
  )

  .example(
    `Downloads the latest nightly release from the Yarn repository - v2 only!`,
    `yarn policies set-version berry`,
  )

  .example(
    `Downloads the latest nightly release from the Yarn repository - v1 only!`,
    `yarn policies set-version nightly`,
  )

  .example(
    `Switches back to Yarn v1`,
    `yarn policies set-version ^1`,
  )

  .example(
    `Switches back to a specific release`,
    `yarn policies set-version 1.14.0`,
  )

  .action(async ({cwd, stdout, range, rc}: {cwd: string, stdin: Readable, stdout: Writable, range: string, rc: boolean}) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project} = await Project.find(configuration, cwd);

    stdout.write(`Resolving ${configuration.format(range, `yellow`)} to a url...\n`);

    if (range === `rc`) {
      range = `latest`;
      rc = true;
    }

    if (range === `latest`)
      range = `*`;

    let bundleUrl;
    let bundleVersion;

    if (range === `nightly` || range === `nightlies`) {
      bundleUrl = `https://nightly.yarnpkg.com/latest.js`;
      bundleVersion = `nightly`;
    } else if (range === `berry` || range === `v2` || range === `2`) {
      bundleUrl = `https://github.com/yarnpkg/yarn-berry/raw/master/packages/berry-cli/bin/berry.js`;
      bundleVersion = `berry`;
    } else {
      const releases = await fetchReleases(configuration, {
        includePrereleases: rc,
      });

      const release = releases.find(release => {
        return semver.satisfies(release.version, range);
      });

      if (!release) {
        throw new Error(`Release not found: ${range}`);
      }

      const asset = getBundleAsset(release);

      if (!asset) {
        throw new Error(`The bundle asset should exist`);
      }

      bundleUrl = asset.browser_download_url;
      bundleVersion = release.version.version;
    }

    stdout.write(`Downloading ${configuration.format(bundleUrl, `green`)}...\n`);
    const bundle = await httpUtils.get(bundleUrl, configuration);

    const executablePath = `.berry/releases/berry-${bundleVersion}.js`;
    const absoluteExecutablePath = posix.resolve(project.cwd, executablePath);

    stdout.write(`Saving it into ${configuration.format(executablePath, `magenta`)}...\n`);
    await xfs.mkdirpPromise(posix.dirname(absoluteExecutablePath));
    await xfs.writeFilePromise(absoluteExecutablePath, bundle);
    await xfs.chmodPromise(absoluteExecutablePath, 0o755);

    await Configuration.updateConfiguration(project.cwd, {
      executablePath,
    });
  });

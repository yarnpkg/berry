import {Configuration, PluginConfiguration, Project} from '@berry/core';
import {httpUtils}                                   from '@berry/core';
import {xfs}                                         from '@berry/fslib';
import {UsageError}                                  from 'clipanion';
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

async function fetchReleases(configuration: Configuration, {includePrereleases = false}: Partial<FetchReleasesOptions> = {}): Promise<{releases: Array<Release>, prereleases: Array<Release>}> {
  const request = await httpUtils.get(`https://api.github.com/repos/yarnpkg/yarn/releases`, configuration);
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

// eslint-disable-next-line arca/no-default-export
export default (clipanion: any, pluginConfiguration: PluginConfiguration) => clipanion

  .command(`policies set-version [range] [--rc] [--list]`)

  .categorize(`Policies-related commands`)
  .describe(`lock the version of Berry used in the project`)

  .validate(yup.object().shape({
    range: yup.string().default(`berry`),
  }))

  .detail(`
    This command will download a specific release of Yarn directly from the Yarn Github repository, will store it inside your project, and will change the \`yarn-path\` settings from your project .yarnrc to point to the new file.

    A very good use case for this command is to enforce the version of Yarn used by the any single member of your team inside a same project - by doing this you ensure that you have control on Yarn upgrades and downgrades (including on your deployment servers), and get rid of most of the headaches related to someone using a slightly different version and getting a different behavior than you.

    The command will by default only consider stable releases as valid candidates, but releases candidates can be downloaded as well provided you add the \`--rc\` flag. Note that because you're on the v2 alpha trunk, running the command without parameter will always download the latest build straight from the repository. This behavior will be tweaked near the release to only download stable releases once more.

    Adding the \`--list\` will simply cause Yarn to print the builds that would have been valid candidates for the given range.
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

  .action(async ({cwd, stdout, range, rc, list}: {cwd: string, stdin: Readable, stdout: Writable, range: string, rc: boolean, list: boolean }) => {
    const configuration = await Configuration.find(cwd, pluginConfiguration);
    const {project} = await Project.find(configuration, cwd);

    if (range === `rc`) {
      range = `latest`;
      rc = true;
    }

    if (range === `latest`)
      range = `*`;

    let bundleUrl;
    let bundleVersion;

    if (range === `berry` || range === `v2` || range === `2` || range === `nightly` || range === `nightlies`) {
      bundleUrl = `https://github.com/yarnpkg/berry/raw/master/packages/berry-cli/bin/berry.js`;
      bundleVersion = `berry`;

      if (list) {
        stdout.write(`${bundleUrl}\n`);
        return 0;
      }
    } else {
      const {releases, prereleases} = await fetchReleases(configuration, {
        includePrereleases: rc,
      });

      if (list) {
        for (const release of releases)
          if (semver.satisfies(release.version, range))
            stdout.write(`${release.version.version}\n`);
  
        return 0;
      }

      const release = releases.find(release => semver.satisfies(release.version, range));
      if (!release) {
        if (prereleases.find(release => semver.satisfies(release.version, range))) {
          throw new UsageError(`No matching release found for range ${range}, but a prerelease was found - run with --rc to use it.`);
        } else {
          throw new UsageError(`No matching release found for range ${range}.`);
        }
      }
  
      const asset = getBundleAsset(release);
      if (!asset)
        throw new Error(`The bundle asset should exist`);

      bundleUrl = asset.browser_download_url;
      bundleVersion = release.version.version;
    }

    stdout.write(`Downloading ${configuration.format(bundleUrl, `green`)}...\n`);
    const bundle = await httpUtils.get(bundleUrl, configuration);

    const yarnPath = `.yarn/releases/yarn-${bundleVersion}.js`;
    const absoluteYarn = posix.resolve(project.cwd, yarnPath);

    stdout.write(`Saving it into ${configuration.format(yarnPath, `magenta`)}...\n`);
    await xfs.mkdirpPromise(posix.dirname(absoluteYarn));
    await xfs.writeFilePromise(absoluteYarn, bundle);
    await xfs.chmodPromise(absoluteYarn, 0o755);

    await Configuration.updateConfiguration(project.cwd, {
      yarnPath,
    });
  });

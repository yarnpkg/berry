import chalk = require('chalk');
import Joi = require('joi');
import semver = require('semver');

import {Configuration, Project}          from '@berry/core';
import {httpUtils}                       from '@berry/core';
import {parseSyml, stringifySyml}        from '@berry/parsers';
import {mkdirp, chmod, writeFile}        from 'fs-extra';
import {existsSync}                      from 'fs';
import {dirname, resolve}                from 'path';
import {SemVer}                          from 'semver';
import {Readable, Writable}              from 'stream';

import {plugins}                         from '../../plugins';

// @ts-ignore
const ctx = new chalk.constructor({enabled: true});

function color(configuration: Configuration, text: string, color: string) {
  if (configuration.enableColors) {
    return ctx.keyword(color)(text);
  } else {
    return text;
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

export default (concierge: any) => concierge

  .command(`policies set-version [range] [--rc]`)

  .categorize(`Policies-related commands`)
  .describe(`lock the version of Berry used in the project`)

  .validate(Joi.object().unknown().keys({
    range: Joi.string().default(`latest`),
  }))

  .action(async ({cwd, stdin, stdout, range, rc}: {cwd: string, stdin: Readable, stdout: Writable, range: string, rc: boolean}) => {
    const configuration = await Configuration.find(cwd, plugins);
    const {project} = await Project.find(configuration, cwd);

    stdout.write(`Resolving ${color(configuration, range, `yellow`)} to a url...\n`);

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

    stdout.write(`Downloading ${color(configuration, bundleUrl, `green`)}...\n`);
    const bundle = await httpUtils.get(bundleUrl, configuration);

    const executablePath = `.berry/releases/berry-${bundleVersion}.js`;
    const absoluteExecutablePath = resolve(project.cwd, executablePath);

    stdout.write(`Saving it into ${color(configuration, executablePath, `magenta`)}...\n`);
    await mkdirp(dirname(absoluteExecutablePath));
    await writeFile(absoluteExecutablePath, bundle);
    await chmod(absoluteExecutablePath, 0o755);

    await Configuration.updateConfiguration(project.cwd, {
      executablePath,
    });
  });

import {Configuration, formatUtils, httpUtils, miscUtils, semverUtils} from "@yarnpkg/core";
import {PortablePath}                                                  from "@yarnpkg/fslib";
import {parseSyml}                                                     from "@yarnpkg/parsers";
import {UsageError}                                                    from "clipanion";

export const REPO_URL = `https://repo.yarnpkg.com`;

export const TAG_REGISTRY_URL = `${REPO_URL}/tags`;

// Doesn't depend on the default branch name
export const SOURCES_URL = `https://raw.githubusercontent.com/yarnpkg/berry/HEAD`;

export enum Latest {
  STABLE = `stable`,
  CANARY = `canary`,
}

export type Tags = {
  latest: Record<Latest, string>;
  tags: Array<string>;
};

export async function resolveRange(configuration: Configuration, request: string) {
  const data: Tags = await httpUtils.get(`https://repo.yarnpkg.com/tags`, {configuration, jsonResponse: true});

  const candidates = data.tags.filter(version => semverUtils.satisfiesWithPrereleases(version, request));
  if (candidates.length === 0)
    throw new UsageError(`No matching release found for range ${formatUtils.pretty(configuration, request, formatUtils.Type.RANGE)}.`);

  // The tags on the website are sorted by semver descending
  return candidates[0];
}

export async function resolveTag(configuration: Configuration, request: Latest) {
  const data: Tags = await httpUtils.get(`https://repo.yarnpkg.com/tags`, {configuration, jsonResponse: true});
  if (!data.latest[request])
    throw new UsageError(`Tag ${formatUtils.pretty(configuration, request, formatUtils.Type.RANGE)} not found`);

  return data.latest[request];
}

export async function resolveRequest(configuration: Configuration, request: string) {
  return semverUtils.validRange(request)
    ? resolveRange(configuration, request)
    : resolveTag(configuration, miscUtils.validateEnum(Latest, request));
}

export async function makeFileUrl(configuration: Configuration, request: string, file: PortablePath) {
  const version = await resolveRequest(configuration, request);
  return `${REPO_URL}/${version}/${file}`;
}

export async function makeBundleUrl(configuration: Configuration, request: string) {
  return await makeFileUrl(configuration, request, `packages/yarnpkg-cli/bin/yarn.js` as PortablePath);
}

export async function makePluginUrl(configuration: Configuration, request: string, pluginSpec: string) {
  const pluginName = pluginSpec.replace(/@yarnpkg\//, ``);

  return await makeFileUrl(configuration, request, `packages/${pluginName}/bin/@yarnpkg/${pluginName}.js` as PortablePath);
}


async function getAvailablePluginsImpl(configuration: Configuration, url: string) {
  const raw = await httpUtils.get(url, {configuration});
  const data = parseSyml(raw.toString());

  return data;
}

export async function getAvailablePlugins(configuration: Configuration, request: string) {
  return getAvailablePluginsImpl(configuration, await makeFileUrl(configuration, request, `plugins.yml` as PortablePath));
}

export function getAvailablePluginsFromSources(configuration: Configuration) {
  return getAvailablePluginsImpl(configuration, `${SOURCES_URL}/plugins.yml`);
}

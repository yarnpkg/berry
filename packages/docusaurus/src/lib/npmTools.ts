import {normalizeRepoUrl}          from '@yarnpkg/monorepo/packages/plugin-git/sources/utils/normalizeRepoUrl';
import DOMPurify                   from 'dompurify';
import gitUrlParse                 from 'git-url-parse';
// @ts-expect-error
import {Marked}                    from 'marked';
import {useQuery}                  from 'react-query';
import {resolve as resolveExports} from 'resolve.exports';
import resolve                     from 'resolve';

export const STANDARD_EXTENSIONS = [
  `.js`, `.cjs`, `.mjs`,
];

export type PackageInfo = {
  error?: string;
  name: string;
  [`dist-tags`]: Record<string, string>;
  versions: Record<string, any>;
  time: Record<string, string>;
  readme: string;
};

export type ReleaseNpmInfo = {
  deprecated?: any;
  main?: any;
  type?: any;
  types?: any;
  typings?: any;
  exports?: any;
  homepage?: any;
  readme?: any;
  repository?: {
    type?: any;
    url?: any;
    directory?: any;
  };
  scripts?: any;
};

export type ReleaseJsDelivrInfo = {
  files: Array<ReleaseFile>;
  fileSet: Set<string>;
};

export type ReleaseInfo = {
  name: string;
  version: string;
  npm: ReleaseNpmInfo;
  jsdelivr: ReleaseJsDelivrInfo;
};

export type ReleaseFile = {
  name: string;
  hash: string;
  time: string;
  size: number;
};

export type PackageListingError =
  | {type: `VersionNotFound`};

export type WithErrors<T, TError extends {type: string}> =
  | (T & {error?: null})
  | { error: TError };

export type PackageInfoQuery = ReturnType<typeof usePackageInfo>;
export type ReleaseInfoQuery = ReturnType<typeof useReleaseInfo>;

export function usePackageInfo(name: string) {
  return useQuery([`packageRegistryMetadata`, name], async (): Promise<PackageInfo> => {
    // eslint-disable-next-line no-restricted-globals
    const req = await fetch(`https://registry.yarnpkg.com/${name}`);
    const res = await req.json();

    return res;
  }).data!;
}

export function usePackageExists(name: string | null) {
  return useQuery([`packageExists`, name], async () => {
    if (name === null)
      return false;

    // eslint-disable-next-line no-restricted-globals
    const req = await fetch(`https://cdn.jsdelivr.net/npm/${name}/package.json`);

    return req.status === 200;
  });
}

export function useResolvedVersion({name, version}: {name: string, version: string | null}) {
  const pkgInfo = usePackageInfo(name);

  return version ?? pkgInfo[`dist-tags`].latest;
}

export function useReleaseInfo({name, version}: {name: string, version: string | null}): ReleaseInfo {
  const pkgInfo = usePackageInfo(name);

  const resolvedVersion = useResolvedVersion({
    name,
    version,
  });

  const jsDelivrInfo = useQuery([`packageFiles`, name, resolvedVersion], async () => {
    // eslint-disable-next-line no-restricted-globals
    const req = await fetch(`https://data.jsdelivr.com/v1/package/npm/${name}@${resolvedVersion}/flat`);
    const res = await req.json();

    const fileSet = new Set<string>();
    for (const file of res.files)
      fileSet.add(file.name);

    return {files: res.files as Array<ReleaseFile>, fileSet};
  }).data!;

  return {
    name,
    version: resolvedVersion,
    npm: pkgInfo.versions[resolvedVersion],
    jsdelivr: jsDelivrInfo,
  };
}

export function useReleaseFile({name, version}: {name: string, version: string}, path: string | null) {
  return useQuery([`packageFile`, name, version, path], async () => {
    if (path === null)
      return null;

    // eslint-disable-next-line no-restricted-globals
    const req = await fetch(`https://cdn.jsdelivr.net/npm/${name}@${version}${path}`);
    const res = await req.text();

    return res;
  }).data!;
}

export function useReleaseReadme({name, version}: {name: string, version: string}) {
  const pkgInfo = usePackageInfo(name);

  const files = useReleaseInfo({
    name,
    version,
  });

  const readmeFile = files.npm.readme ?? files.jsdelivr.files.find(entry => {
    return entry.name.toLowerCase() === `/readme.md`;
  });

  const readmeContent = useReleaseFile({name, version}, readmeFile?.name ?? null);
  const readmeText = readmeContent ?? files.npm.readme ?? pkgInfo.readme;

  const marked = new Marked();
  const domPurify = DOMPurify();

  domPurify.addHook(`uponSanitizeAttribute`, (node, data) => {
    if (data.attrName === `src` && !data.attrValue.startsWith(`//`) && !data.attrValue.includes(`:`)) {
      const url = new URL(data.attrValue, `https://example.org`).pathname;
      if (files.jsdelivr.files.some(entry => entry.name === url)) {
        data.attrValue = `https://cdn.jsdelivr.net/npm/${name}@${version}${url}`;
      } else if (files.npm.repository?.url) {
        const normalizedRepositoryUrl = normalizeRepoUrl(files.npm.repository.url);
        const repoInfo = gitUrlParse(normalizedRepositoryUrl);

        if (repoInfo.owner && repoInfo.name && repoInfo.source === `github.com`) {
          data.attrValue = `https://cdn.jsdelivr.net/gh/${repoInfo.owner}/${repoInfo.name}${url}`;
        }
      }
    }
  });

  const readmeHtml = marked.parse(readmeText, {
    headerIds: false,
    headerPrefix: ``,
    mangle: false,
  });

  const readmeHtmlSanitized = domPurify.sanitize(readmeHtml);
  return readmeHtmlSanitized;
}

function getResolutionFunction(releaseInfo: ReleaseInfo, {extensions = STANDARD_EXTENSIONS}: {extensions?: Array<string>} = {}) {
  return (qualifier: string) => resolve.sync(qualifier, {
    basedir: `/`,
    includeCoreModules: true,
    paths: [],
    extensions,
    isFile: path => releaseInfo.jsdelivr.files.some(file => file.name === path),
    isDirectory: path => releaseInfo.jsdelivr.files.some(file => file.name.startsWith(`${path}/`)),
    realpathSync: path => path,
    readPackageSync: (_, path) => {
      if (path === `/package.json`) {
        return releaseInfo.npm;
      } else {
        throw new Error(`Failed`);
      }
    },
  });
}

function resolveQualifier(releaseInfo: ReleaseInfo, qualifier: string) {
  const resolvedQualifier = new URL(qualifier, `https://example.com/`).pathname;
  const resolutionFunction = getResolutionFunction(releaseInfo);

  try {
    return resolutionFunction(resolvedQualifier);
  } catch {
    return null;
  }
}

export function useResolution({name, version}: {name: string, version: string}, {mainFields, conditions, extensions}: {mainFields: Array<keyof ReleaseNpmInfo>, conditions: Array<string>, extensions?: Array<string>}) {
  const releaseInfo = useReleaseInfo({
    name,
    version,
  });

  const exportsResolution = resolveExports(releaseInfo.npm, `.`, {
    conditions,
  })?.[0];

  if (releaseInfo.npm.exports && !exportsResolution)
    return null;

  if (exportsResolution)
    return resolveQualifier(releaseInfo, exportsResolution);

  for (const mainField of mainFields) {
    const resolution = resolveQualifier(releaseInfo, releaseInfo.npm[mainField] || `.`);
    if (resolution !== null) {
      return resolution;
    }
  }

  return null;
}

import {Configuration, Ident, formatUtils, httpUtils, nodeUtils, StreamReport, structUtils, hashUtils, Project, miscUtils, Cache} from '@yarnpkg/core';
import {MessageName, ReportError}                                                                                                 from '@yarnpkg/core';
import {Filename, PortablePath, ppath, xfs}                                                                                       from '@yarnpkg/fslib';
import {prompt}                                                                                                                   from 'enquirer';
import {pick}                                                                                                                     from 'es-toolkit/compat';
import semver                                                                                                                     from 'semver';

import {Hooks}                                                                                                                    from './index';
import * as npmConfigUtils                                                                                                        from './npmConfigUtils';
import {MapLike}                                                                                                                  from './npmConfigUtils';

export enum AuthType {
  NO_AUTH,
  BEST_EFFORT,
  CONFIGURATION,
  ALWAYS_AUTH,
}

type RegistryOptions = {
  ident: Ident;
  registry?: string;
} | {
  ident?: Ident;
  registry: string;
};

export type Options = httpUtils.Options & RegistryOptions & {
  authType?: AuthType;
  allowOidc?: boolean;
  otp?: string;
};

/**
 * Consumes all 401 Unauthorized errors and reports them as `AUTHENTICATION_INVALID`.
 *
 * It doesn't handle 403 Forbidden, as the npm registry uses it when the user attempts
 * a prohibited action, such as publishing a package with a similar name to an existing package.
 */
export async function handleInvalidAuthenticationError(error: any, {attemptedAs, registry, headers, configuration}: {attemptedAs?: string, registry: string, headers: {[key: string]: string | undefined} | undefined, configuration: Configuration}) {
  if (isOtpError(error))
    throw new ReportError(MessageName.AUTHENTICATION_INVALID, `Invalid OTP token`);

  if (error.originalError?.name === `HTTPError` && error.originalError?.response.statusCode === 401) {
    throw new ReportError(MessageName.AUTHENTICATION_INVALID, `Invalid authentication (${typeof attemptedAs !== `string` ? `as ${await whoami(registry, headers, {configuration})}` : `attempted as ${attemptedAs}`})`);
  }
}

export function customPackageError(error: httpUtils.RequestError, configuration: Configuration) {
  const statusCode = error.response?.statusCode;
  if (!statusCode)
    return null;

  if (statusCode === 404)
    return `Package not found`;

  if (statusCode >= 500 && statusCode < 600)
    return `The registry appears to be down (using a ${formatUtils.applyHyperlink(configuration, `local cache`, `https://yarnpkg.com/advanced/lexicon#local-cache`)} might have protected you against such outages)`;

  return null;
}

export function getIdentUrl(ident: Ident) {
  if (ident.scope) {
    return `/@${ident.scope}%2f${ident.name}`;
  } else {
    return `/${ident.name}`;
  }
}

export type GetPackageMetadataOptions = Omit<Options, `ident` | `configuration`> & {
  cache?: Cache;
  project: Project;

  /**
   * Warning: This option will return all cached metadata if the version is found, but the rest of the metadata can be stale.
   */
  version?: string;
};

// We use 2 different caches:
// - an in-memory cache, to avoid hitting the disk and the network more than once per process for each package
// - an on-disk cache, for exact version matches and to avoid refetching the metadata if the resource hasn't changed on the server

const PACKAGE_DISK_METADATA_CACHE = new Map<PortablePath, Promise<CachedMetadata | null>>();
const PACKAGE_NETWORK_METADATA_CACHE = new Map<PortablePath, Promise<CachedMetadata | null>>();

async function loadPackageMetadataInfoFromDisk(identPath: PortablePath) {
  return await miscUtils.getFactoryWithDefault(PACKAGE_DISK_METADATA_CACHE, identPath, async () => {
    let cached: CachedMetadata | null = null;

    try {
      cached = await xfs.readJsonPromise(identPath) as CachedMetadata;
    } catch {}

    return cached;
  });
}

type LoadPackageMetadataInfoFromNetworkOptions = {
  configuration: Configuration;
  cached: CachedMetadata | null;
  registry: string;
  headers?: {[key: string]: string | undefined};
  version?: string;
};

async function loadPackageMetadataInfoFromNetwork(identPath: PortablePath, ident: Ident, {configuration, cached, registry, headers, version, ...rest}: LoadPackageMetadataInfoFromNetworkOptions) {
  return await miscUtils.getFactoryWithDefault(PACKAGE_NETWORK_METADATA_CACHE, identPath, async () => {
    return await get(getIdentUrl(ident), {
      ...rest,
      customErrorMessage: customPackageError,
      configuration,
      registry,
      ident,
      headers: {
        ...headers,
        // We set both headers in case a registry doesn't support ETags
        [`If-None-Match`]: cached?.etag,
        [`If-Modified-Since`]: cached?.lastModified,
      },
      wrapNetworkRequest: async executor => async () => {
        const response = await executor();

        if (response.statusCode === 304) {
          if (cached === null)
            throw new Error(`Assertion failed: cachedMetadata should not be null`);

          return {
            ...response,
            body: cached.metadata,
          };
        }

        const packageMetadata = pickPackageMetadata(JSON.parse(response.body.toString()));

        const metadata: CachedMetadata = {
          metadata: packageMetadata,
          etag: response.headers.etag,
          lastModified: response.headers[`last-modified`],
        };

        PACKAGE_DISK_METADATA_CACHE.set(identPath, Promise.resolve(metadata));

        // We don't need the cache in this process anymore (since we stored everything in both memory caches),
        // so we can run the part that writes the cache to disk in the background.
        Promise.resolve().then(async () => {
          // We append the PID because it is guaranteed that this code is only run once per process for a given ident
          const identPathTemp = `${identPath}-${process.pid}.tmp` as PortablePath;

          await xfs.mkdirPromise(ppath.dirname(identPathTemp), {recursive: true});
          await xfs.writeJsonPromise(identPathTemp, metadata, {compact: true});

          // Doing a rename is important to ensure the cache is atomic
          await xfs.renamePromise(identPathTemp, identPath);
        }).catch(() => {
          // It's not dramatic if the cache can't be written, so we just ignore the error
        });

        return {
          ...response,
          body: packageMetadata,
        };
      },
    });
  });
}

function generateMetadataFileName(ident: Ident) {
  if (ident.scope !== null) {
    return `@${ident.scope}-${ident.name}-${ident.scope.length}`;
  } else {
    return ident.name;
  }
}

/**
 * Caches and returns the package metadata for the given ident.
 *
 * Note: This function only caches and returns specific fields from the metadata.
 * If you need other fields, use the uncached {@link get} or consider whether it would make more sense to extract
 * the fields from the on-disk packages using the linkers or from the fetch results using the fetchers.
 */
export async function getPackageMetadata(ident: Ident, {cache, project, registry, headers, version, ...rest}: GetPackageMetadataOptions): Promise<PackageMetadata> {
  const {configuration} = project;

  registry = normalizeRegistry(configuration, {ident, registry});

  const registryFolder = getRegistryFolder(configuration, registry);
  const identPath = ppath.join(registryFolder, `${generateMetadataFileName(ident)}.json`);

  let cached: CachedMetadata | null = null;

  // We bypass the on-disk cache for security reasons if the lockfile needs to be refreshed,
  // since most likely the user is trying to validate the metadata using hardened mode.
  if (!project.lockfileNeedsRefresh) {
    cached = await loadPackageMetadataInfoFromDisk(identPath);

    if (cached) {
      if (typeof version !== `undefined` && typeof cached.metadata.versions[version] !== `undefined`)
        return cached.metadata;


      // If in offline mode, we change the metadata to pretend that the only versions available
      // on the registry are the ones currently stored in our cache. This is to avoid the resolver
      // to try to resolve to a version that we wouldn't be able to download.
      if (configuration.get(`enableOfflineMode`)) {
        const copy = structuredClone(cached.metadata);
        const deleted = new Set();

        if (cache) {
          for (const version of Object.keys(copy.versions)) {
            const locator = structUtils.makeLocator(ident, `npm:${version}`);
            const mirrorPath = cache.getLocatorMirrorPath(locator);

            if (!mirrorPath || !xfs.existsSync(mirrorPath)) {
              delete copy.versions[version];
              deleted.add(version);
            }
          }

          const latest = copy[`dist-tags`].latest;
          if (deleted.has(latest)) {
            const allVersions = Object.keys(cached.metadata.versions)
              .sort(semver.compare);

            let latestIndex = allVersions.indexOf(latest);
            while (deleted.has(allVersions[latestIndex]) && latestIndex >= 0)
              latestIndex -= 1;

            if (latestIndex >= 0) {
              copy[`dist-tags`].latest = allVersions[latestIndex];
            } else {
              delete copy[`dist-tags`].latest;
            }
          }
        }

        return copy;
      }
    }
  }

  return await loadPackageMetadataInfoFromNetwork(identPath, ident, {
    ...rest,
    configuration,
    cached,
    registry,
    headers,
    version,
  });
}

type CachedMetadata = {
  metadata: PackageMetadata;
  etag?: string;
  lastModified?: string;
};

const CACHED_FIELDS = [
  `name`,

  `dist.tarball`,

  `bin`,
  `scripts`,

  `os`,
  `cpu`,
  `libc`,

  `dependencies`,
  `dependenciesMeta`,
  `optionalDependencies`,

  `peerDependencies`,
  `peerDependenciesMeta`,

  `deprecated`,
] as const;

export type PackageMetadata = {
  'dist-tags': Record<string, string>;
  versions: Record<string, {
    [key in typeof CACHED_FIELDS[number]]: any;
  } & {
    dist: {
      tarball: string;
    };
  }>;
  time?: Record<string, string>;
};

function pickPackageMetadata(metadata: PackageMetadata): PackageMetadata {
  return {
    'dist-tags': metadata[`dist-tags`],
    versions: Object.fromEntries(Object.entries(metadata.versions).map(([key, value]) => [
      key,
      pick(value, CACHED_FIELDS) as any,
    ])),
    time: metadata.time,
  };
}

/**
 * Used to invalidate the on-disk cache when the format changes.
 */
const CACHE_KEY = hashUtils.makeHash(`time`, ...CACHED_FIELDS).slice(0, 6);

function getRegistryFolder(configuration: Configuration, registry: string) {
  const metadataFolder = getMetadataFolder(configuration);
  const parsed = new URL(registry);

  return ppath.join(metadataFolder, CACHE_KEY as Filename, parsed.hostname as Filename);
}

function getMetadataFolder(configuration: Configuration) {
  return ppath.join(configuration.get(`globalFolder`), `metadata/npm`);
}

export async function get(path: string, {configuration, headers, ident, authType, allowOidc, registry, ...rest}: Options) {
  registry = normalizeRegistry(configuration, {ident, registry});

  if (ident && ident.scope && typeof authType === `undefined`)
    authType = AuthType.BEST_EFFORT;

  const auth = await getAuthenticationHeader(registry, {authType, allowOidc, configuration, ident});
  if (auth)
    headers = {...headers, authorization: auth};

  try {
    return await httpUtils.get(path.charAt(0) === `/` ? `${registry}${path}` : path, {configuration, headers, ...rest});
  } catch (error) {
    await handleInvalidAuthenticationError(error, {registry, configuration, headers});

    throw error;
  }
}

export async function post(path: string, body: httpUtils.Body, {attemptedAs, configuration, headers, ident, authType = AuthType.ALWAYS_AUTH, allowOidc, registry, otp, ...rest}: Options & {attemptedAs?: string}) {
  registry = normalizeRegistry(configuration, {ident, registry});

  const auth = await getAuthenticationHeader(registry, {authType, allowOidc, configuration, ident});
  if (auth)
    headers = {...headers, authorization: auth};
  if (otp)
    headers = {...headers, ...getOtpHeaders(otp)};

  try {
    return await httpUtils.post(registry + path, body, {configuration, headers, ...rest});
  } catch (error) {
    if (!isOtpError(error) || otp) {
      await handleInvalidAuthenticationError(error, {attemptedAs, registry, configuration, headers});

      throw error;
    }

    otp = await askForOtp(error, {configuration});
    const headersWithOtp = {...headers, ...getOtpHeaders(otp)};

    // Retrying request with OTP
    try {
      return await httpUtils.post(`${registry}${path}`, body, {configuration, headers: headersWithOtp, ...rest});
    } catch (error) {
      await handleInvalidAuthenticationError(error, {attemptedAs, registry, configuration, headers});

      throw error;
    }
  }
}

export async function put(path: string, body: httpUtils.Body, {attemptedAs, configuration, headers, ident, authType = AuthType.ALWAYS_AUTH, allowOidc, registry, otp, ...rest}: Options & {attemptedAs?: string}) {
  registry = normalizeRegistry(configuration, {ident, registry});

  const auth = await getAuthenticationHeader(registry, {authType, allowOidc, configuration, ident});
  if (auth)
    headers = {...headers, authorization: auth};
  if (otp)
    headers = {...headers, ...getOtpHeaders(otp)};

  try {
    return await httpUtils.put(registry + path, body, {configuration, headers, ...rest});
  } catch (error) {
    if (!isOtpError(error)) {
      await handleInvalidAuthenticationError(error, {attemptedAs, registry, configuration, headers});

      throw error;
    }

    otp = await askForOtp(error, {configuration});
    const headersWithOtp = {...headers, ...getOtpHeaders(otp)};

    // Retrying request with OTP
    try {
      return await httpUtils.put(`${registry}${path}`, body, {configuration, headers: headersWithOtp, ...rest});
    } catch (error) {
      await handleInvalidAuthenticationError(error, {attemptedAs, registry, configuration, headers});

      throw error;
    }
  }
}

export async function del(path: string, {attemptedAs, configuration, headers, ident, authType = AuthType.ALWAYS_AUTH, allowOidc, registry, otp, ...rest}: Options & {attemptedAs?: string}) {
  registry = normalizeRegistry(configuration, {ident, registry});

  const auth = await getAuthenticationHeader(registry, {authType, allowOidc, configuration, ident});
  if (auth)
    headers = {...headers, authorization: auth};
  if (otp)
    headers = {...headers, ...getOtpHeaders(otp)};

  try {
    return await httpUtils.del(registry + path, {configuration, headers, ...rest});
  } catch (error) {
    if (!isOtpError(error) || otp) {
      await handleInvalidAuthenticationError(error, {attemptedAs, registry, configuration, headers});

      throw error;
    }

    otp = await askForOtp(error, {configuration});
    const headersWithOtp = {...headers, ...getOtpHeaders(otp)};

    // Retrying request with OTP
    try {
      return await httpUtils.del(`${registry}${path}`, {configuration, headers: headersWithOtp, ...rest});
    } catch (error) {
      await handleInvalidAuthenticationError(error, {attemptedAs, registry, configuration, headers});

      throw error;
    }
  }
}

function normalizeRegistry(configuration: Configuration, {ident, registry}: Partial<RegistryOptions>): string {
  if (typeof registry === `undefined` && ident)
    return npmConfigUtils.getScopeRegistry(ident.scope, {configuration});

  if (typeof registry !== `string`)
    throw new Error(`Assertion failed: The registry should be a string`);

  return npmConfigUtils.normalizeRegistry(registry);
}

async function getAuthenticationHeader(registry: string, {authType = AuthType.CONFIGURATION, allowOidc = false, configuration, ident}: {authType?: AuthType, allowOidc?: boolean, configuration: Configuration, ident: RegistryOptions[`ident`]}) {
  const effectiveConfiguration = npmConfigUtils.getAuthConfiguration(registry, {configuration, ident});
  const mustAuthenticate = shouldAuthenticate(effectiveConfiguration, authType);

  if (!mustAuthenticate)
    return null;

  const header = await configuration.reduceHook((hooks: Hooks) => {
    return hooks.getNpmAuthenticationHeader;
  }, undefined, registry, {configuration, ident});

  if (header)
    return header;

  if (effectiveConfiguration.get(`npmAuthToken`))
    return `Bearer ${effectiveConfiguration.get(`npmAuthToken`)}`;

  if (effectiveConfiguration.get(`npmAuthIdent`)) {
    const npmAuthIdent = effectiveConfiguration.get(`npmAuthIdent`);
    if (npmAuthIdent.includes(`:`))
      return `Basic ${Buffer.from(npmAuthIdent).toString(`base64`)}`;
    return `Basic ${npmAuthIdent}`;
  }

  if (allowOidc && ident) {
    const oidcToken = await getOidcToken(registry, {configuration, ident});
    if (oidcToken) {
      return `Bearer ${oidcToken}`;
    }
  }

  if (mustAuthenticate && authType !== AuthType.BEST_EFFORT) {
    throw new ReportError(MessageName.AUTHENTICATION_NOT_FOUND, `No authentication configured for request`);
  } else {
    return null;
  }
}

function shouldAuthenticate(authConfiguration: MapLike, authType: AuthType) {
  switch (authType) {
    case AuthType.CONFIGURATION:
      return authConfiguration.get(`npmAlwaysAuth`);

    case AuthType.BEST_EFFORT:
    case AuthType.ALWAYS_AUTH:
      return true;

    case AuthType.NO_AUTH:
      return false;

    default:
      throw new Error(`Unreachable`);
  }
}

async function whoami(registry: string, headers: {[key: string]: string | undefined} | undefined, {configuration}: {configuration: Configuration}) {
  if (typeof headers === `undefined` || typeof headers.authorization === `undefined`)
    return `an anonymous user`;

  try {
    const response = await httpUtils.get(new URL(`${registry}/-/whoami`).href, {
      configuration,
      headers,
      jsonResponse: true,
    });

    return response.username ?? `an unknown user`;
  } catch {
    return `an unknown user`;
  }
}

async function askForOtp(error: any, {configuration}: {configuration: Configuration}) {
  const notice = error.originalError?.response.headers[`npm-notice`];

  if (notice) {
    await StreamReport.start({
      configuration,
      stdout: process.stdout,
      includeFooter: false,
    }, async report => {
      report.reportInfo(MessageName.UNNAMED, notice.replace(/(https?:\/\/\S+)/g, formatUtils.pretty(configuration, `$1`, formatUtils.Type.URL)));

      if (!process.env.YARN_IS_TEST_ENV) {
        const autoOpen = notice.match(/open (https?:\/\/\S+)/i);
        if (autoOpen && nodeUtils.openUrl) {
          const {openNow} = await prompt<{openNow: boolean}>({
            type: `confirm`,
            name: `openNow`,
            message: `Do you want to try to open this url now?`,
            required: true,
            initial: true,
            onCancel: () => process.exit(130),
          });

          if (openNow) {
            if (!await nodeUtils.openUrl(autoOpen[1])) {
              report.reportSeparator();
              report.reportWarning(MessageName.UNNAMED, `We failed to automatically open the url; you'll have to open it yourself in your browser of choice.`);
            }
          }
        }
      }
    });

    process.stdout.write(`\n`);
  }

  if (process.env.YARN_IS_TEST_ENV)
    return process.env.YARN_INJECT_NPM_2FA_TOKEN || ``;

  const {otp} = await prompt<{otp: string}>({
    type: `password`,
    name: `otp`,
    message: `One-time password:`,
    required: true,
    onCancel: () => process.exit(130),
  });

  process.stdout.write(`\n`);

  return otp;
}

function isOtpError(error: any) {
  if (error.originalError?.name !== `HTTPError`)
    return false;

  try {
    const authMethods = error.originalError?.response.headers[`www-authenticate`].split(/,\s*/).map((s: string) => s.toLowerCase());
    return authMethods.includes(`otp`);
  } catch {
    return false;
  }
}

function getOtpHeaders(otp: string) {
  return {
    [`npm-otp`]: otp,
  };
}

/**
 * This code is adapted from the npm project, under ISC License.
 *
 * Original source:
 * https://github.com/npm/cli/blob/7d900c4656cfffc8cca93240c6cda4b441fbbfaa/lib/utils/oidc.js
 */
async function getOidcToken(registry: string, {configuration, ident}: {configuration: Configuration, ident: Ident}): Promise<string | null> {
  let idToken: string | null = null;

  if (process.env.GITLAB) {
    idToken = process.env.NPM_ID_TOKEN || null;
  } else if (process.env.GITHUB_ACTIONS) {
    if (!(process.env.ACTIONS_ID_TOKEN_REQUEST_URL && process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN))
      return null;

    // The specification for an audience is `npm:registry.npmjs.org`,
    // where "registry.npmjs.org" can be any supported registry.
    const audience = `npm:${new URL(registry).host
      // Yarn registry is an alias domain to the NPM registry.
      .replace(`registry.yarnpkg.com`, `registry.npmjs.org`)
      .replace(`yarn.npmjs.org`, `registry.npmjs.org`)}`;

    const url = new URL(process.env.ACTIONS_ID_TOKEN_REQUEST_URL);
    url.searchParams.append(`audience`, audience);

    const response = await httpUtils.get(url.href, {
      configuration,
      jsonResponse: true,
      headers: {
        Authorization: `Bearer ${process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN}`,
      },
    });

    idToken = response.value;
  }

  if (!idToken)
    return null;

  try {
    const response = await httpUtils.post(
      `${registry}/-/npm/v1/oidc/token/exchange/package${getIdentUrl(ident)}`,
      null,
      {
        configuration,
        jsonResponse: true,
        headers: {
          Authorization: `Bearer ${idToken}`,
        },
      },
    );
    return response.token || null;
  } catch {
    // Best effort
  }

  return null;
}

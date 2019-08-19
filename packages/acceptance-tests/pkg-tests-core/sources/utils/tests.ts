/* @flow */

import {IncomingMessage, ServerResponse} from 'http';
import {Gzip}                            from 'zlib';

const crypto = require('crypto');
const deepResolve = require('super-resolve');
const http = require('http');
const invariant = require('invariant');
const semver = require('semver');

const fsUtils = require('./fs');

export type PackageEntry = Map<string, {path: string, packageJson: Object}>;
export type PackageRegistry = Map<string, PackageEntry>;

export type PackageRunDriver = (
  command: string,
  args: Array<string>,
  opts: {registryUrl: string},
) => Promise<{stdout: Buffer, stderr: Buffer}>;

export type PackageDriver = any;

let whitelist = new Map();

exports.setPackageWhitelist = async function whitelistPackages(
  packages: Map<string, Set<string>>,
  fn: () => Promise<void>,
) {
  whitelist = packages;
  try {
    await fn();
  } finally {
    whitelist = new Map();
  }
};

let packageRegistryPromise = null;

exports.getPackageRegistry = function getPackageRegistry(): Promise<PackageRegistry> {
  if (packageRegistryPromise)
    return packageRegistryPromise;


  return (packageRegistryPromise = (async () => {
    const packageRegistry = new Map();
    for (const packageFile of await fsUtils.walk(`${require(`pkg-tests-fixtures`)}/packages`, {
      filter: ['package.json'],
    })) {
      const packageJson = await fsUtils.readJson(packageFile);

      const {name, version} = packageJson;
      if (name.startsWith('git-'))
        continue;

      let packageEntry = packageRegistry.get(name);
      if (!packageEntry)
        packageRegistry.set(name, (packageEntry = new Map()));

      packageEntry.set(version, {
        path: require('path').posix.dirname(packageFile),
        packageJson,
      });
    }

    return packageRegistry;
  })());
};

exports.getPackageEntry = async function getPackageEntry(name: string): Promise<PackageEntry | undefined> {
  const packageRegistry = await exports.getPackageRegistry();

  return packageRegistry.get(name);
};

exports.getPackageArchiveStream = async function getPackageArchiveStream(name: string, version: string): Promise<Gzip> {
  const packageEntry = await exports.getPackageEntry(name);
  if (!packageEntry)
    throw new Error(`Unknown package "${name}"`);

  const packageVersionEntry = packageEntry.get(version);
  if (!packageVersionEntry)
    throw new Error(`Unknown version "${version}" for package "${name}"`);

  return fsUtils.packToStream(packageVersionEntry.path, {
    virtualPath: '/package',
  });
};

exports.getPackageArchivePath = async function getPackageArchivePath(name: string, version: string): Promise<string> {
  const packageEntry = await exports.getPackageEntry(name);
  if (!packageEntry)
    throw new Error(`Unknown package "${name}"`);

  const packageVersionEntry = packageEntry.get(version);
  if (!packageVersionEntry)
    throw new Error(`Unknown version "${version}" for package "${name}"`);

  const archivePath = await fsUtils.createTemporaryFile(`${name}-${version}.tar.gz`);

  await fsUtils.packToFile(archivePath, packageVersionEntry.path, {
    virtualPath: '/package',
  });

  return archivePath;
};

exports.getPackageArchiveHash = async function getPackageArchiveHash(
  name: string,
  version: string,
): Promise<string | Buffer> {
  const stream = await exports.getPackageArchiveStream(name, version);

  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha1');
    hash.setEncoding('hex');

    // Send the archive to the hash function
    stream.pipe(hash);

    stream.on('end', () => {
      const finalHash = hash.read();
      invariant(finalHash, 'The hash should have been computated');
      resolve(finalHash);
    });
  });
};

exports.getPackageHttpArchivePath = async function getPackageHttpArchivePath(
  name: string,
  version: string,
): Promise<string> {
  const packageEntry = await exports.getPackageEntry(name);
  if (!packageEntry)
    throw new Error(`Unknown package "${name}"`);

  const packageVersionEntry = packageEntry.get(version);
  if (!packageVersionEntry)
    throw new Error(`Unknown version "${version}" for package "${name}"`);

  const serverUrl = await exports.startPackageServer();
  const archiveUrl = `${serverUrl}/${name}/-/${name}-${version}.tgz`;

  return archiveUrl;
};

exports.getPackageDirectoryPath = async function getPackageDirectoryPath(
  name: string,
  version: string,
): Promise<string> {
  const packageEntry = await exports.getPackageEntry(name);
  if (!packageEntry)
    throw new Error(`Unknown package "${name}"`);

  const packageVersionEntry = packageEntry.get(version);
  if (!packageVersionEntry)
    throw new Error(`Unknown version "${version}" for package "${name}"`);

  return packageVersionEntry.path;
};

let packageServerUrl = null;

exports.startPackageServer = function startPackageServer(): Promise<string> {
  if (packageServerUrl !== null)
    return packageServerUrl;

  enum RequestType {
    Login = 'login',
    PackageInfo = 'packageInfo',
    PackageTarball = 'packageTarball',
    Whoami = 'whoami',
  }

  type Request = {
    type: RequestType.Login;
    username: string,
  } | {
    type: RequestType.PackageInfo;
    scope?: string;
    localName: string;
  } | {
    type: RequestType.PackageTarball;
    scope?: string;
    localName: string;
    version?: string;
  } | {
    type: RequestType.Whoami;
  }

  const processors: {[requestType in RequestType]:(parsedRequest: Request, request: IncomingMessage, response: ServerResponse) => Promise<void>} = {
    async [RequestType.PackageInfo](parsedRequest, request, response) {
      const {scope, localName} = parsedRequest;
      const name = scope ? `${scope}/${localName}` : localName;

      const packageEntry = await exports.getPackageEntry(name);
      if (!packageEntry)
        return processError(response, 404, `Package not found: ${name}`);

      let versions = Array.from(packageEntry.keys());

      const whitelistedVersions = whitelist.get(name);
      if (whitelistedVersions)
        versions = versions.filter(version => whitelistedVersions.has(version));

      const data = JSON.stringify({
        name,
        versions: Object.assign(
          {},
          ...(await Promise.all(
            versions.map(async version => {
              const packageVersionEntry = packageEntry.get(version);
              invariant(packageVersionEntry, 'This can only exist');

              return {
                [version as string]: Object.assign({}, packageVersionEntry.packageJson, {
                  dist: {
                    shasum: await exports.getPackageArchiveHash(name, version),
                    tarball: await exports.getPackageHttpArchivePath(name, version),
                  },
                }),
              };
            }),
          )),
        ),
        ['dist-tags']: {latest: semver.maxSatisfying(versions, '*')},
      });

      response.writeHead(200, {['Content-Type']: 'application/json'});
      response.end(data);
    },

    async [RequestType.PackageTarball](parsedRequest, request, response) {
      const {scope, localName, version} = parsedRequest;
      const name = scope ? `${scope}/${localName}` : localName;

      const packageEntry = await exports.getPackageEntry(name);
      if (!packageEntry) {
        processError(response, 404, `Package not found: ${name}`);
        return;
      }

      const packageVersionEntry = packageEntry.get(version);
      if (!packageVersionEntry) {
        processError(response, 404, `Package not found: ${name}@${version}`);
        return;
      }

      response.writeHead(200, {
        ['Content-Type']: 'application/octet-stream',
        ['Transfer-Encoding']: 'chunked',
      });

      const packStream = fsUtils.packToStream(packageVersionEntry.path, {virtualPath: '/package'});
      packStream.pipe(response);
    },

    async [RequestType.Whoami](parsedRequest, request, response) {
      const data = JSON.stringify({
        username: `username`,
      });

      response.writeHead(200, {[`Content-Type`]: `application/json`});
      response.end(data);
    },

    async [RequestType.Login](parsedRequest, request, response) {
      const {username} = parsedRequest;
      const otp = request.headers['npm-otp'];
      const user = validLogins[username];

      if (!user)
        return processError(response, 401, `Unauthorized`);


      if (user.requiresOtp && user.otp !== otp) {
        response.writeHead(401, {
          [`Content-Type`]: `application/json`,
          [`www-authenticate`]: `OTP`,
        });

        return response.end();
      }

      let rawData = '';

      request.on('data', chunk => rawData += chunk);
      request.on('end', () => {
        let body;

        try {
          body = JSON.parse(rawData);
        } catch (e) {
          return processError(response, 401, `Unauthorized`);
        }

        if (body.username !== user.username || body.password !== user.password)
          return processError(response, 401, `Unauthorized`);


        const data = JSON.stringify({token: user.npmAuthToken});

        response.writeHead(200, {[`Content-Type`]: `application/json`});

        return response.end(data);
      });
    },
  };

  function sendError(res: ServerResponse, statusCode: number, errorMessage: string): void {
    res.writeHead(statusCode);
    res.end(errorMessage);
  }

  function processError(res: ServerResponse, statusCode: number, errorMessage: string): void {
    if (statusCode !== 404 && statusCode !== 401)
      console.error(errorMessage);

    sendError(res, statusCode, errorMessage);
  }

  function parseRequest(url: string): Request|null {
    let match: RegExpMatchArray|null;

    url = url.replace(/%2f/g, '/');

    if (match = url.match(/^\/-\/user\/org\.couchdb\.user:(.+)/)) {
      const [_, username] = match;

      return {
        type: RequestType.Login,
        username,
      };
    } else if (url === `/-/whoami`) {
      return {
        type: RequestType.Whoami,
      };
    } else if (match = url.match(/^\/(?:(@[^\/]+)\/)?([^@\/][^\/]*)$/)) {
      const [_, scope, localName] = match;

      return {
        type: RequestType.PackageInfo,
        scope,
        localName,
      };
    } else if (match = url.match(/^\/(?:(@[^\/]+)\/)?([^@\/][^\/]*)\/-\/\2-(.*)\.tgz$/)) {
      const [_, scope, localName, version] = match;

      return {
        type: RequestType.PackageTarball,
        scope,
        localName,
        version,
      };
    }

    return null;
  }

  function needsAuth({scope, localName, type}: Request): boolean {
    return (scope != null && scope.startsWith('@private'))
      || localName && localName.startsWith('private')
      || type === RequestType.Whoami;
  }

  const validLogins = {
    testUser: {
      password: `password`,
      requiresOtp: true,
      otp: `1234`,
      npmAuthToken: `686159dc-64b3-413e-a244-2de2b8d1c36f`,
    },
    anotherTestUser: {
      password: `password123`,
      requiresOtp: false,
      npmAuthToken: `316158de-64b3-413e-a244-2de2b8d1c80f`,
    },
  };

  const validAuthorizations = [
    `Bearer 686159dc-64b3-413e-a244-2de2b8d1c36f`,
    `Basic dXNlcm5hbWU6YSB2ZXJ5IHNlY3VyZSBwYXNzd29yZA==`, // username:a very secure password
  ];

  return new Promise((resolve, reject) => {
    const server = http.createServer(
      (req, res) =>
        void (async () => {
          try {
            const parsedRequest = parseRequest(req.url);

            if (parsedRequest == null) {
              processError(res, 404, `Invalid route: ${req.url}`);
              return;
            }

            const {authorization} = req.headers;
            if (authorization != null) {
              if (!validAuthorizations.includes(authorization)) {
                sendError(res, 403, `Forbidden`);
                return;
              }
            } else if (needsAuth(parsedRequest)) {
              sendError(res, 401, `Authentication required`);
              return;
            }

            await processors[parsedRequest.type](parsedRequest, req, res);
          } catch (error) {
            processError(res, 500, error.stack);
          }
        })(),
    );

    // We don't want the server to prevent the process from exiting
    server.unref();
    server.listen(() => {
      const {port} = server.address();
      resolve((packageServerUrl = `http://localhost:${port}`));
    });
  });
};

exports.generatePkgDriver = function generatePkgDriver({
  getName,
  runDriver,
}: {
  getName: () => string,
  runDriver: PackageRunDriver,
}): PackageDriver {
  function withConfig(definition): PackageDriver {
    const makeTemporaryEnv = (packageJson, subDefinition, fn) => {
      if (typeof subDefinition === 'function') {
        fn = subDefinition;
        subDefinition = {};
      }

      if (typeof fn !== 'function') {
        throw new Error(
          // eslint-disable-next-line
          `Invalid test function (got ${typeof fn}) - you probably put the closing parenthesis of the "makeTemporaryEnv" utility at the wrong place`,
        );
      }

      return Object.assign(async function(): Promise<void> {
        const path = await fsUtils.realpath(await fsUtils.createTemporaryFolder());

        const registryUrl = await exports.startPackageServer();

        // Writes a new package.json file into our temporary directory
        await fsUtils.writeJson(`${path}/package.json`, await deepResolve(packageJson));

        const run = (...args) => {
          let callDefinition = {};

          if (args.length > 0 && typeof args[args.length - 1] === 'object')
            callDefinition = args.pop();

          return runDriver(path, args, {
            registryUrl,
            ...definition,
            ...subDefinition,
            ...callDefinition,
          });
        };

        const source = async script => {
          return JSON.parse((await run('node', '-p', `JSON.stringify((() => ${script})())`)).stdout.toString());
        };

        try {
          await fn({
            path,
            run,
            source,
          });
        } catch (error) {
          error.message = `Temporary fixture folder: ${path}\n\n${error.message}`;
          throw error;
        }
      });
    };

    makeTemporaryEnv.getPackageManagerName = () => {
      return getName();
    };

    makeTemporaryEnv.withConfig = subDefinition => {
      return withConfig({...definition, ...subDefinition});
    };

    return makeTemporaryEnv;
  }

  return withConfig({});
};

exports.testIf = function testIf(condition, name, execute, timeout) {
  if (condition()) {
    test(name, execute, timeout);
  }
};

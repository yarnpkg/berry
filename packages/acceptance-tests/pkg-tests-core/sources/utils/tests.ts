import {PortablePath, npath, toFilename} from '@yarnpkg/fslib';
import assert                            from 'assert';
import crypto                            from 'crypto';
import finalhandler                      from 'finalhandler';
import https                             from 'https';
import {IncomingMessage, ServerResponse} from 'http';
import http                              from 'http';
import invariant                         from 'invariant';
import {AddressInfo}                     from 'net';
import pem                               from 'pem';
import semver                            from 'semver';
import serveStatic                       from 'serve-static';
import {promisify}                       from 'util';
import {v5 as uuidv5}                    from 'uuid';
import {Gzip}                            from 'zlib';

import {ExecResult}                      from './exec';
import * as fsUtils                      from './fs';

const deepResolve = require(`super-resolve`);
const staticServer = serveStatic(npath.fromPortablePath(require(`pkg-tests-fixtures`)));

export type PackageEntry = Map<string, {path: string, packageJson: Record<string, any>}>;
export type PackageRegistry = Map<string, PackageEntry>;

interface RunDriverOptions extends Record<string, any> {
  cwd?: PortablePath;
  projectFolder?: PortablePath;
  registryUrl: string;
  env?: Record<string, string>;
}

export type PackageRunDriver = (
  path: PortablePath,
  args: Array<string>,
  opts: RunDriverOptions,
) => Promise<ExecResult>;

export enum RequestType {
  Login = `login`,
  PackageInfo = `packageInfo`,
  PackageTarball = `packageTarball`,
  Whoami = `whoami`,
  Repository = `repository`,
  Publish = `publish`,
}

export type Request = {
  type: RequestType.Login;
  username: string;
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
  login: Login;
} | {
  type: RequestType.Repository;
} | {
  type: RequestType.Publish;
  scope?: string;
  localName: string;
};

export class Login {
  username: string;
  password: string;

  npmOtpToken: string | null;
  npmAuthToken: string | null;

  npmAuthIdent: {
    decoded: string;
    encoded: string;
  };

  constructor(username: string, {otp}: {otp?: boolean} = {}) {
    this.username = username;
    this.password = crypto.createHash(`sha1`).update(username).digest(`hex`);

    this.npmOtpToken = otp ? Buffer.from(this.password, `hex`).slice(0, 4).join(``) : null;
    this.npmAuthToken = uuidv5(this.password, `06030d6c-8c43-412a-ad0a-787f1fb9e31e`);

    const authIdent = `${this.username}:${this.password}`;

    this.npmAuthIdent = {
      decoded: authIdent,
      encoded: Buffer.from(authIdent).toString(`base64`),
    };
  }
}

export const validLogins = {
  fooUser: new Login(`foo-user`),
  barUser: new Login(`bar-user`),
  otpUser: new Login(`otp-user`, {otp: true}),
} as const;

let whitelist = new Map();
let recording: Array<Request> | null = null;

export const startRegistryRecording = async (
  fn: () => Promise<void>,
) => {
  const currentRecording: Array<Request> = [];
  recording = currentRecording;

  try {
    await fn();
    return currentRecording;
  } finally {
    recording = null;
  }
};

export const setPackageWhitelist = async (
  packages: Map<string, Set<string>>,
  fn: () => Promise<void>,
) => {
  whitelist = packages;
  try {
    await fn();
  } finally {
    whitelist = new Map();
  }
};

let packageRegistryPromise: Promise<PackageRegistry> | null = null;

export const getPackageRegistry = (): Promise<PackageRegistry> => {
  if (packageRegistryPromise)
    return packageRegistryPromise;

  return (packageRegistryPromise = (async () => {
    const packageRegistry = new Map();
    for (const packageFile of await fsUtils.walk(npath.toPortablePath(`${require(`pkg-tests-fixtures`)}/packages`), {
      filter: [`package.json`],
    })) {
      const packageJson = await fsUtils.readJson(packageFile);

      const {name, version} = packageJson;
      if (name.startsWith(`git-`))
        continue;

      let packageEntry = packageRegistry.get(name);
      if (!packageEntry)
        packageRegistry.set(name, (packageEntry = new Map()));

      packageEntry.set(version, {
        path: require(`path`).posix.dirname(packageFile),
        packageJson,
      });
    }

    return packageRegistry;
  })());
};

export const getPackageEntry = async (name: string): Promise<PackageEntry | undefined> => {
  const packageRegistry = await getPackageRegistry();

  return packageRegistry.get(name);
};

export const getPackageArchiveStream = async (name: string, version: string): Promise<Gzip> => {
  const packageEntry = await getPackageEntry(name);
  if (!packageEntry)
    throw new Error(`Unknown package "${name}"`);

  const packageVersionEntry = packageEntry.get(version);
  if (!packageVersionEntry)
    throw new Error(`Unknown version "${version}" for package "${name}"`);

  return fsUtils.packToStream(npath.toPortablePath(packageVersionEntry.path), {
    virtualPath: npath.toPortablePath(`/package`),
  });
};

export const getPackageArchivePath = async (name: string, version: string): Promise<string> => {
  const packageEntry = await getPackageEntry(name);
  if (!packageEntry)
    throw new Error(`Unknown package "${name}"`);

  const packageVersionEntry = packageEntry.get(version);
  if (!packageVersionEntry)
    throw new Error(`Unknown version "${version}" for package "${name}"`);

  const archivePath = await fsUtils.createTemporaryFile(toFilename(`${name}-${version}.tar.gz`));

  await fsUtils.packToFile(archivePath, npath.toPortablePath(packageVersionEntry.path), {
    virtualPath: npath.toPortablePath(`/package`),
  });

  return archivePath;
};

export const getPackageArchiveHash = async (
  name: string,
  version: string,
): Promise<string | Buffer> => {
  const stream = await getPackageArchiveStream(name, version);

  return new Promise((resolve, reject) => {
    const hash = crypto.createHash(`sha1`);
    hash.setEncoding(`hex`);

    // Send the archive to the hash function
    stream.pipe(hash);

    stream.on(`end`, () => {
      const finalHash = hash.read();
      invariant(finalHash, `The hash should have been computated`);
      resolve(finalHash);
    });
  });
};

export const getPackageHttpArchivePath = async (
  name: string,
  version: string,
): Promise<string> => {
  const packageEntry = await getPackageEntry(name);
  if (!packageEntry)
    throw new Error(`Unknown package "${name}"`);

  const packageVersionEntry = packageEntry.get(version);
  if (!packageVersionEntry)
    throw new Error(`Unknown version "${version}" for package "${name}"`);

  const localName = name.replace(/^@[^/]+\//, ``);

  const serverUrl = await startPackageServer();
  const archiveUrl = `${serverUrl}/${name}/-/${localName}-${version}.tgz`;

  return archiveUrl;
};

export const getPackageDirectoryPath = async (
  name: string,
  version: string,
): Promise<string> => {
  const packageEntry = await getPackageEntry(name);
  if (!packageEntry)
    throw new Error(`Unknown package "${name}"`);

  const packageVersionEntry = packageEntry.get(version);
  if (!packageVersionEntry)
    throw new Error(`Unknown version "${version}" for package "${name}"`);

  return packageVersionEntry.path;
};

const packageServerUrls: {
  http: Promise<string> | null;
  https: Promise<string> | null;
} = {http: null, https: null};

export const startPackageServer = ({type}: { type: keyof typeof packageServerUrls } = {type: `http`}): Promise<string> => {
  const serverUrl = packageServerUrls[type];
  if (serverUrl !== null)
    return serverUrl;

  const applyOtpValidation = (req: IncomingMessage, res: ServerResponse, user: Login) => {
    const otp = req.headers[`npm-otp`];
    if (user.npmOtpToken === null || otp === user.npmOtpToken)
      return true;

    res.writeHead(401, {
      [`Content-Type`]: `application/json`,
      [`www-authenticate`]: `OTP`,
    });

    res.end();
    return false;
  };

  const processors: {[requestType in RequestType]: (parsedRequest: Request, request: IncomingMessage, response: ServerResponse) => Promise<void>} = {
    async [RequestType.PackageInfo](parsedRequest, _, response) {
      if (parsedRequest.type !== RequestType.PackageInfo)
        throw new Error(`Assertion failed: Invalid request type`);

      const {scope, localName} = parsedRequest;
      const name = scope ? `${scope}/${localName}` : localName;

      const packageEntry = await getPackageEntry(name);
      if (!packageEntry) {
        processError(response, 404, `Package not found: ${name}`);
        return;
      }

      let versions = Array.from(packageEntry.keys());

      const whitelistedVersions = whitelist.get(name);
      if (whitelistedVersions)
        versions = versions.filter(version => whitelistedVersions.has(version));

      const allDistTags = versions.map(version => {
        const packageVersionEntry = packageEntry.get(version);
        invariant(packageVersionEntry, `This can only exist`);

        return packageVersionEntry!.packageJson[`dist-tags`];
      });

      const distTags = allDistTags[0];

      // If a package defines dist-tags, all of its versions must define the same dist-tags
      for (const versionDistTags of allDistTags.slice(1))
        assert.deepStrictEqual(versionDistTags, distTags);

      if (typeof distTags === `object` && distTags !== null && !Object.prototype.hasOwnProperty.call(distTags, `latest`))
        throw new Error(`Assertion failed: The package "${name}" must define a "latest" dist-tag too if it defines any dist-tags`);

      const data = JSON.stringify({
        name,
        versions: Object.assign(
          {},
          ...(await Promise.all(
            versions.map(async version => {
              const packageVersionEntry = packageEntry.get(version);
              invariant(packageVersionEntry, `This can only exist`);

              return {
                [version as string]: Object.assign({}, packageVersionEntry!.packageJson, {
                  dist: {
                    shasum: await getPackageArchiveHash(name, version),
                    tarball: (localName === `unconventional-tarball` || localName === `private-unconventional-tarball`)
                      ? (await getPackageHttpArchivePath(name, version)).replace(`/-/`, `/tralala/`)
                      : await getPackageHttpArchivePath(name, version),
                  },
                }),
              };
            }),
          )),
        ),
        [`dist-tags`]: {
          latest: semver.maxSatisfying(versions, `*`),
          ...distTags,
        },
      });

      response.writeHead(200, {[`Content-Type`]: `application/json`});
      response.end(data);
    },

    async [RequestType.PackageTarball](parsedRequest, request, response) {
      if (parsedRequest.type !== RequestType.PackageTarball)
        throw new Error(`Assertion failed: Invalid request type`);

      const {scope, localName, version} = parsedRequest;
      const name = scope ? `${scope}/${localName}` : localName;

      const packageEntry = await getPackageEntry(name);
      if (!packageEntry) {
        processError(response, 404, `Package not found: ${name}`);
        return;
      }

      const packageVersionEntry = packageEntry.get(version!);
      if (!packageVersionEntry) {
        processError(response, 404, `Package not found: ${name}@${version}`);
        return;
      }

      response.writeHead(200, {
        [`Content-Type`]: `application/octet-stream`,
        [`Transfer-Encoding`]: `chunked`,
      });

      const packStream = fsUtils.packToStream(npath.toPortablePath(packageVersionEntry.path), {virtualPath: npath.toPortablePath(`/package`)});
      packStream.pipe(response);
    },

    async [RequestType.Whoami](parsedRequest, request, response) {
      if (parsedRequest.type !== RequestType.Whoami)
        throw new Error(`Assertion failed: Invalid request type`);

      const data = JSON.stringify({
        username: parsedRequest.login.username,
      });

      response.writeHead(200, {[`Content-Type`]: `application/json`});
      response.end(data);
    },

    async [RequestType.Login](parsedRequest, request, response) {
      if (parsedRequest.type !== RequestType.Login)
        throw new Error(`Assertion failed: Invalid request type`);

      const user = [...Object.values(validLogins)].find(user => {
        return user.username === parsedRequest.username;
      });

      if (typeof user === `undefined`) {
        processError(response, 401, `Unauthorized`);
        return;
      }

      if (!applyOtpValidation(request, response, user))
        return;

      let rawData = ``;

      request.on(`data`, chunk => rawData += chunk);
      request.on(`end`, () => {
        let body;
        try {
          body = JSON.parse(rawData);
        } catch (e) {
          return processError(response, 401, `Unauthorized`);
        }

        if (body.name !== user.username || body.password !== user.password)
          return processError(response, 401, `Unauthorized`);

        const data = JSON.stringify({token: user.npmAuthToken});

        response.writeHead(200, {[`Content-Type`]: `application/json`});

        return response.end(data);
      });
    },

    async [RequestType.Repository](parsedRequest, request, response) {
      staticServer(request as any, response as any, finalhandler(request, response));
    },
    async [RequestType.Publish](parsedRequest, request, response) {
      if (parsedRequest.type !== RequestType.Publish)
        throw new Error(`Assertion failed: Invalid request type`);

      const {scope, localName} = parsedRequest;
      const name = scope ? `${scope}/${localName}` : localName;

      let rawData = ``;

      request.on(`data`, chunk => rawData += chunk);
      request.on(`end`, () => {
        let body;
        try {
          body = JSON.parse(rawData);
        } catch (e) {
          return processError(response, 401, `Invalid`);
        }

        const [version] = Object.keys(body.versions);
        if (!body.versions[version].gitHead && name === `githead-required`)
          return processError(response, 400, `Missing gitHead`);

        if (typeof body.versions[version].gitHead !== `undefined` && name === `githead-forbidden`)
          return processError(response, 400, `Unexpected gitHead`);

        response.writeHead(200, {[`Content-Type`]: `application/json`});
        return response.end(rawData);
      });
    },
  };

  const sendError = (res: ServerResponse, statusCode: number, errorMessage: string): void => {
    res.writeHead(statusCode);
    res.end(errorMessage);
  };

  const processError = (res: ServerResponse, statusCode: number, errorMessage: string): void => {
    if (statusCode !== 404 && statusCode !== 401)
      console.error(errorMessage);

    sendError(res, statusCode, errorMessage);
  };

  const parseRequest = (url: string, method: string): Request | null => {
    let match: RegExpMatchArray | null;

    url = url.replace(/%2f/g, `/`);

    if ((match = url.match(/^\/repositories\//))) {
      return {
        type: RequestType.Repository,
      };
    } else if ((match = url.match(/^\/-\/user\/org\.couchdb\.user:(.+)/))) {
      const [, username] = match;

      return {
        type: RequestType.Login,
        username,
      };
    } else if (url === `/-/whoami`) {
      return {
        type: RequestType.Whoami,
        // Set later when login is parsed
        login: null as any,
      };
    } else if ((match = url.match(/^\/(?:(@[^/]+)\/)?([^@/][^/]*)$/)) && method == `PUT`) {
      const [, scope, localName] = match;

      return {
        type: RequestType.Publish,
        scope,
        localName,
      };
    } else if ((match = url.match(/^\/(?:(@[^/]+)\/)?([^@/][^/]*)$/))) {
      const [, scope, localName] = match;

      return {
        type: RequestType.PackageInfo,
        scope,
        localName,
      };
    } else if ((match = url.match(/^\/(?:(@[^/]+)\/)?([^@/][^/]*)\/(-|tralala)\/\2-(.*)\.tgz$/))) {
      const [, scope, localName, split, version] = match;

      if ((localName === `unconventional-tarball` || localName === `private-unconventional-tarball`) && split === `-`)
        return null;

      return {
        type: RequestType.PackageTarball,
        scope,
        localName,
        version,
      };
    }

    return null;
  };

  const needsAuth = (parsedRequest: Request): boolean => {
    switch (parsedRequest.type) {
      case RequestType.Publish:
      case RequestType.Whoami:
        return true;

      case RequestType.PackageInfo:
      case RequestType.PackageTarball: {
        if (parsedRequest.scope && parsedRequest.scope.startsWith(`@private`)) {
          return true;
        } else {
          return parsedRequest.localName.startsWith(`private`);
        }
      }

      default: {
        return false;
      }
    }
  };

  const validAuthorizations = new Map<string, Login>();

  for (const user of Object.values(validLogins)) {
    validAuthorizations.set(`Bearer ${user.npmAuthToken}`, user);
    validAuthorizations.set(`Basic ${user.npmAuthIdent.encoded}`, user);
  }

  return packageServerUrls[type] = new Promise((resolve, reject) => {
    const listener: http.RequestListener = (req, res) =>
      void (async () => {
        try {
          const parsedRequest = parseRequest(req.url!, req.method!);
          if (parsedRequest == null) {
            processError(res, 404, `Invalid route: ${req.url}`);
            return;
          }

          if (recording !== null)
            recording.push(parsedRequest);

          const {authorization} = req.headers;
          if (authorization != null) {
            const user = validAuthorizations.get(authorization);
            if (!user) {
              sendError(res, 401, `Invalid token`);
              return;
            }

            if (!applyOtpValidation(req, res, user))
              return;

            if (parsedRequest.type === RequestType.Whoami) {
              parsedRequest.login = user;
            }
          } else if (needsAuth(parsedRequest)) {
            sendError(res, 401, `Authentication required`);
            return;
          }

          await processors[parsedRequest.type](parsedRequest, req, res);
        } catch (error) {
          processError(res, 500, error.stack);
        }
      })();

    (async () => {
      let server: https.Server | http.Server;

      if (type === `https`) {
        const certs = await getHttpsCertificates();

        server = https.createServer({
          cert: certs.server.certificate,
          key: certs.server.clientKey,
          ca: certs.ca.certificate,
        }, listener);
      } else if (type === `http`) {
        server = http.createServer(listener);
      } else {
        throw new Error(`Invalid server type: ${type}`);
      }

      // We don't want the server to prevent the process from exiting
      server.unref();
      server.listen(() => {
        const {port} = server.address() as AddressInfo;
        resolve(`${type}://localhost:${port}`);
      });
    })();
  });
};

export interface PackageDriver {
  (packageJson: Record<string, any>, subDefinition: Record<string, any> | RunFunction, fn?: RunFunction): any;
  getPackageManagerName: () => string;
  withConfig: (definition: Record<string, any>) => PackageDriver;
}

export type Run = (...args: Array<string> | [...Array<string>, Partial<RunDriverOptions>]) => Promise<ExecResult>;
export type Source = (script: string, callDefinition?: Record<string, any>) => Promise<Record<string, any>>;

export type RunFunction = (
  {path, run, source}:
  {
    path: PortablePath;
    run: Run;
    source: Source;
  }
) => void;

export const generatePkgDriver = ({
  getName,
  runDriver,
}: {
  getName: () => string;
  runDriver: PackageRunDriver;
}): PackageDriver => {
  const withConfig = (definition: Record<string, any>): PackageDriver => {
    const makeTemporaryEnv: PackageDriver = (packageJson, subDefinition, fn) => {
      if (typeof subDefinition === `function`) {
        fn = subDefinition as RunFunction;
        subDefinition = {};
      }

      if (typeof fn !== `function`) {
        throw new Error(
          // eslint-disable-next-line
          `Invalid test function (got ${typeof fn}) - you probably put the closing parenthesis of the "makeTemporaryEnv" utility at the wrong place`,
        );
      }

      return Object.assign(async (): Promise<void> => {
        const path = await fsUtils.realpath(await fsUtils.createTemporaryFolder());

        const registryUrl = await startPackageServer();

        // Writes a new package.json file into our temporary directory
        await fsUtils.writeJson(npath.toPortablePath(`${path}/package.json`), await deepResolve(packageJson));

        const run = (...args: Array<any>) => {
          let callDefinition = {};

          if (args.length > 0 && typeof args[args.length - 1] === `object`)
            callDefinition = args.pop();

          return runDriver(path, args, {
            registryUrl,
            ...definition,
            ...subDefinition,
            ...callDefinition,
          });
        };

        const source = async (script: string, callDefinition: Record<string, any> = {}): Promise<Record<string, any>> => {
          const scriptWrapper = `
            Promise.resolve().then(async () => ${script}).then(result => {
              return {type: 'success', result};
            }, err => {
              if (!(err instanceof Error))
                return err;

              const copy = {message: err.message};
              if (err.code)
                copy.code = err.code;
              if (err.pnpCode)
                copy.pnpCode = err.pnpCode;

              return {type: 'failure', result: copy};
            }).then(payload => {
              console.log(JSON.stringify(payload));
            })
          `.replace(/\n/g, ``);

          const result = await run(`node`, `-e`, scriptWrapper, callDefinition);
          const content = result.stdout.toString();

          let data;
          try {
            data = JSON.parse(content);
          } catch {
            throw new Error(`Error when parsing JSON payload (${content})`);
          }

          if (data.type === `failure`) {
            throw {externalException: data.result};
          } else {
            return data.result;
          }
        };

        try {
          await fn!({path, run, source});
        } catch (error) {
          error.message = `Temporary fixture folder: ${npath.fromPortablePath(path)}\n\n${error.message}`;
          throw error;
        }
      });
    };

    makeTemporaryEnv.getPackageManagerName = () => {
      return getName();
    };

    makeTemporaryEnv.withConfig = (subDefinition: Record<string, any>) => {
      return withConfig({...definition, ...subDefinition});
    };

    return makeTemporaryEnv;
  };

  return withConfig({});
};

export const testIf = (condition: () => boolean, name: string,
  execute?: jest.ProvidesCallback | undefined, timeout?: number | undefined) => {
  if (condition()) {
    test(name, execute, timeout);
  }
};

let httpsCertificates: {
  server: pem.CertificateCreationResult;
  ca: pem.CertificateCreationResult;
};

export const getHttpsCertificates = async () => {
  if (httpsCertificates)
    return httpsCertificates;

  const createCSR = promisify<pem.CSRCreationOptions, { csr: string, clientKey: string }>(pem.createCSR);
  const createCertificate = promisify<pem.CertificateCreationOptions, pem.CertificateCreationResult>(pem.createCertificate);

  const {csr, clientKey} = await createCSR({commonName: `yarn`});
  const caCertificate = await createCertificate({
    csr,
    clientKey,
    selfSigned: true,
  });

  const serverCSRResult = await createCSR({commonName: `localhost`});

  const serverCertificate = await createCertificate({
    csr: serverCSRResult.csr,
    clientKey: serverCSRResult.clientKey,
    serviceKey: caCertificate.clientKey,
    serviceCertificate: caCertificate.certificate,
    days: 365,
  });

  return (httpsCertificates = {server: serverCertificate, ca: caCertificate});
};

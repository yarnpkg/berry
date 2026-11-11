import {Project, structUtils} from '@yarnpkg/core';
import {npath, xfs}           from '@yarnpkg/fslib';
import {npmHttpUtils}         from '@yarnpkg/plugin-npm';
import http                   from 'http';
import {AddressInfo}          from 'net';

import {makeConfiguration}    from './_makeConfiguration';

describe(`npm metadata cache`, () => {
  const requests: Array<{url: string, headers: http.IncomingHttpHeaders}> = [];
  const servers: Array<http.Server> = [];
  const registries: Array<string> = [];

  beforeAll(async () => {
    for (let index = 0; index < 2; index++) {
      const server = http.createServer((request, response) => {
        const url = `http://${request.headers.host}${request.url}`;
        const registry = new URL(`.`, url).href.replace(/\/$/, ``);
        requests.push({url, headers: request.headers});

        response.writeHead(200, {
          [`Content-Type`]: `application/json`,
          [`ETag`]: `"metadata"`,
          [`Last-Modified`]: `Mon, 01 Jan 2024 00:00:00 GMT`,
        });
        response.end(JSON.stringify({
          [`dist-tags`]: {latest: `1.0.0`},
          versions: {
            [`1.0.0`]: {dist: {tarball: `${registry}/no-deps/-/no-deps-1.0.0.tgz`}},
          },
        }));
      });
      servers.push(server);
      await new Promise<void>(resolve => server.listen(0, `127.0.0.1`, resolve));
      registries.push(`http://127.0.0.1:${(server.address() as AddressInfo).port}`);
    }
  });

  afterAll(async () => {
    await Promise.all(servers.map(server => new Promise<void>((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    })));
  });

  beforeEach(() => {
    requests.length = 0;
  });

  async function makeProject() {
    const directory = await xfs.mktempPromise();
    const configuration = await makeConfiguration();
    configuration.use(`test`, {
      globalFolder: npath.fromPortablePath(directory),
      unsafeHttpWhitelist: [`127.0.0.1`],
    }, directory, {overwrite: true});
    return new Project(directory, {configuration});
  }

  for (const difference of [`path`, `port`]) {
    for (const version of [undefined, `1.0.0`]) {
      it(`should isolate registries with a different ${difference} for ${version ?? `unversioned`} reads`, async () => {
        const project = await makeProject();
        const ident = structUtils.makeIdent(null, `no-deps`);
        const first = `${registries[0]}/one`;
        const second = difference === `path` ? `${registries[0]}/two` : `${registries[1]}/one`;

        for (const registry of [first, second, first, second]) {
          const metadata = await npmHttpUtils.getPackageMetadata(ident, {project, registry, version});
          expect(metadata.versions[`1.0.0`].dist.tarball).toEqual(`${registry}/no-deps/-/no-deps-1.0.0.tgz`);
        }

        expect(requests.map(request => request.url)).toEqual([`${first}/no-deps`, `${second}/no-deps`]);
        for (const {headers} of requests) {
          expect(headers[`if-none-match`]).toBeUndefined();
          expect(headers[`if-modified-since`]).toBeUndefined();
        }
      });
    }
  }

  it(`should reuse metadata when only the registry's trailing slash changes`, async () => {
    const project = await makeProject();
    const ident = structUtils.makeIdent(null, `no-deps`);
    const registry = `${registries[0]}/one`;
    const metadata = await npmHttpUtils.getPackageMetadata(ident, {project, registry});

    await expect(npmHttpUtils.getPackageMetadata(ident, {project, registry: `${registry}/`})).resolves.toEqual(metadata);
    expect(requests).toHaveLength(1);
  });
});

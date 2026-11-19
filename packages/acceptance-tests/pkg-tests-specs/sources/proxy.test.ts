import {ppath}     from '@yarnpkg/fslib';
import {fs, tests} from 'pkg-tests-core';

const {writeFile} = fs;
const {startPackageServer, startProxyServer, getProxyServerConnectCount, getHttpsCertificates, validLogins} = tests;

describe(`Proxy tests`, () => {
  test(
    `it should install packages from an HTTP server through an HTTP proxy`,
    makeTemporaryEnv(
      {
        dependencies: {[`@private/package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        const url = await startPackageServer();
        const proxyUrl = await startProxyServer();

        await writeFile(ppath.join(path, `.yarnrc.yml`), [
          `httpProxy: "${proxyUrl}"`,
          `npmScopes:`,
          `  private:`,
          `    npmRegistryServer: "${url}"`,
          `    npmAuthToken: ${validLogins.fooUser.npmAuthToken}`,
        ].join(`\n`));

        await run(`install`);

        await expect(source(`require('@private/package')`)).resolves.toMatchObject({
          name: `@private/package`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should install packages from an HTTPS server through an HTTP proxy`,
    makeTemporaryEnv(
      {
        dependencies: {[`@private/package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        const url = await startPackageServer({type: `https`});
        const proxyUrl = await startProxyServer();
        const certs = await getHttpsCertificates();

        const caPath = ppath.join(path, `rootCA.crt`);

        await writeFile(caPath, certs.ca.certificate);
        await writeFile(ppath.join(path, `.yarnrc.yml`), [
          `httpsProxy: "${proxyUrl}"`,
          `httpsCaFilePath: ${caPath}`,
          `npmScopes:`,
          `  private:`,
          `    npmRegistryServer: "${url}"`,
          `    npmAuthToken: ${validLogins.fooUser.npmAuthToken}`,
        ].join(`\n`));

        await run(`install`);

        await expect(source(`require('@private/package')`)).resolves.toMatchObject({
          name: `@private/package`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should install packages from an HTTPS server through an HTTP proxy with enableStrictSsl: false`,
    makeTemporaryEnv(
      {
        dependencies: {[`@private/package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        const url = await startPackageServer({type: `https`});
        const proxyUrl = await startProxyServer();

        await writeFile(ppath.join(path, `.yarnrc.yml`), [
          `httpsProxy: "${proxyUrl}"`,
          `enableStrictSsl: false`,
          `npmScopes:`,
          `  private:`,
          `    npmRegistryServer: "${url}"`,
          `    npmAuthToken: ${validLogins.fooUser.npmAuthToken}`,
        ].join(`\n`));

        await run(`install`);

        await expect(source(`require('@private/package')`)).resolves.toMatchObject({
          name: `@private/package`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should install packages from an HTTP server through an HTTPS proxy`,
    makeTemporaryEnv(
      {
        dependencies: {[`@private/package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        const url = await startPackageServer();
        const proxyUrl = await startProxyServer({type: `https`});
        const certs = await getHttpsCertificates();

        const caPath = ppath.join(path, `rootCA.crt`);

        await writeFile(caPath, certs.ca.certificate);
        await writeFile(ppath.join(path, `.yarnrc.yml`), [
          `httpProxy: "${proxyUrl}"`,
          `httpsCaFilePath: ${caPath}`,
          `npmScopes:`,
          `  private:`,
          `    npmRegistryServer: "${url}"`,
          `    npmAuthToken: ${validLogins.fooUser.npmAuthToken}`,
        ].join(`\n`));

        await run(`install`);

        await expect(source(`require('@private/package')`)).resolves.toMatchObject({
          name: `@private/package`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should install packages from an HTTP server through an HTTPS proxy with enableStrictSsl: false`,
    makeTemporaryEnv(
      {
        dependencies: {[`@private/package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        const url = await startPackageServer();
        const proxyUrl = await startProxyServer({type: `https`});

        await writeFile(ppath.join(path, `.yarnrc.yml`), [
          `httpProxy: "${proxyUrl}"`,
          `enableStrictSsl: false`,
          `npmScopes:`,
          `  private:`,
          `    npmRegistryServer: "${url}"`,
          `    npmAuthToken: ${validLogins.fooUser.npmAuthToken}`,
        ].join(`\n`));

        await run(`install`);

        await expect(source(`require('@private/package')`)).resolves.toMatchObject({
          name: `@private/package`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should install packages from an HTTPS server through an HTTPS proxy`,
    makeTemporaryEnv(
      {
        dependencies: {[`@private/package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        const url = await startPackageServer({type: `https`});
        const proxyUrl = await startProxyServer({type: `https`});
        const certs = await getHttpsCertificates();

        const caPath = ppath.join(path, `rootCA.crt`);

        await writeFile(caPath, certs.ca.certificate);
        await writeFile(ppath.join(path, `.yarnrc.yml`), [
          `httpsProxy: "${proxyUrl}"`,
          `httpsCaFilePath: ${caPath}`,
          `npmScopes:`,
          `  private:`,
          `    npmRegistryServer: "${url}"`,
          `    npmAuthToken: ${validLogins.fooUser.npmAuthToken}`,
        ].join(`\n`));

        await run(`install`);

        await expect(source(`require('@private/package')`)).resolves.toMatchObject({
          name: `@private/package`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should install packages from an HTTPS server through an HTTPS proxy with enableStrictSsl: false`,
    makeTemporaryEnv(
      {
        dependencies: {[`@private/package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        const url = await startPackageServer({type: `https`});
        const proxyUrl = await startProxyServer({type: `https`});

        await writeFile(ppath.join(path, `.yarnrc.yml`), [
          `httpsProxy: "${proxyUrl}"`,
          `enableStrictSsl: false`,
          `npmScopes:`,
          `  private:`,
          `    npmRegistryServer: "${url}"`,
          `    npmAuthToken: ${validLogins.fooUser.npmAuthToken}`,
        ].join(`\n`));

        await run(`install`);

        await expect(source(`require('@private/package')`)).resolves.toMatchObject({
          name: `@private/package`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should reuse the proxy tunnel for subsequent requests`,
    makeTemporaryEnv(
      {
        dependencies: {
          [`@private/package`]: `1.0.0`,
          [`@private/has-bin-entry`]: `1.0.0`,
        },
      },
      async ({path, run, source}) => {
        const url = await startPackageServer({type: `https`});
        const proxyUrl = await startProxyServer();
        const certs = await getHttpsCertificates();

        const caPath = ppath.join(path, `rootCA.crt`);

        await writeFile(caPath, certs.ca.certificate);
        await writeFile(ppath.join(path, `.yarnrc.yml`), [
          `httpsProxy: "${proxyUrl}"`,
          `httpsCaFilePath: ${caPath}`,
          // One request at a time, so that every request can reuse the tunnel of the previous one
          `networkConcurrency: 1`,
          `npmScopes:`,
          `  private:`,
          `    npmRegistryServer: "${url}"`,
          `    npmAuthToken: ${validLogins.fooUser.npmAuthToken}`,
        ].join(`\n`));

        const connectCount = getProxyServerConnectCount();

        await run(`install`);

        // All requests for the two packages go through the one tunnel; without reuse every request opens its own
        expect(getProxyServerConnectCount() - connectCount).toEqual(1);

        await expect(source(`require('@private/package')`)).resolves.toMatchObject({
          name: `@private/package`,
          version: `1.0.0`,
        });
      },
    ),
  );
});

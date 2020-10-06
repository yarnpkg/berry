const {
  fs: {writeFile},
  tests: {startPackageServer, getHttpsCertificates},
} = require(`pkg-tests-core`);

const AUTH_TOKEN = `686159dc-64b3-413e-a244-2de2b8d1c36f`;

describe(`Https tests`, () => {
  test(
    `it should fail to install if server uses non trusted certificate`,
    makeTemporaryEnv(
      {
        dependencies: {[`@private/package`]: `1.0.0`},
      },
      async ({path, run}) => {
        const url = await startPackageServer({type: `https`});

        await writeFile(`${path}/.yarnrc.yml`, [
          `npmScopes:`,
          `  private:`,
          `    npmRegistryServer: "${url}"`,
          `    npmAuthToken: ${AUTH_TOKEN}`,
        ].join(`\n`));

        await expect(run(`install`)).rejects.toThrow(`RequestError: self signed certificate`);
      },
    ),
  );

  test(
    `it should install when providing valid root CA certificate`,
    makeTemporaryEnv(
      {
        dependencies: {[`@private/package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        const url = await startPackageServer({type: `https`});
        const certs = await getHttpsCertificates();

        await writeFile(`${path}/rootCA.crt`, certs.ca.certificate);
        await writeFile(`${path}/.yarnrc.yml`, [
          `caFilePath: ${path}/rootCA.crt`,
          `npmScopes:`,
          `  private:`,
          `    npmRegistryServer: "${url}"`,
          `    npmAuthToken: ${AUTH_TOKEN}`,
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
    `it should allow bypassing ssl certificate errors`,
    makeTemporaryEnv(
      {
        dependencies: {[`@private/package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        const url = await startPackageServer({type: `https`});

        await writeFile(`${path}/.yarnrc.yml`, [
          `enableStrictSsl: false`,
          `npmScopes:`,
          `  private:`,
          `    npmRegistryServer: "${url}"`,
          `    npmAuthToken: ${AUTH_TOKEN}`,
        ].join(`\n`));

        await run(`install`);

        await expect(source(`require('@private/package')`)).resolves.toMatchObject({
          name: `@private/package`,
          version: `1.0.0`,
        });
      },
    ),
  );
});

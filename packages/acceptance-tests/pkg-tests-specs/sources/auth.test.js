const {
  fs: {writeFile},
  tests: {startPackageServer},
} = require(`pkg-tests-core`);

const AUTH_TOKEN = `686159dc-64b3-413e-a244-2de2b8d1c36f`;
const AUTH_IDENT = `dXNlcm5hbWU6YSB2ZXJ5IHNlY3VyZSBwYXNzd29yZA==`; // username:a very secure password

const INVALID_AUTH_TOKEN = `a24cb960-e6a5-45fc-b9ab-0f9fe0aaae57`;
const INVALID_AUTH_IDENT = `dXNlcm5hbWU6bm90IHRoZSByaWdodCBwYXNzd29yZA==`; // username:not the right password

describe(`Auth tests`, () => {
  test(
    `it should fail to install unscoped packages which require authentication if no authentication is configured`,
    makeTemporaryEnv(
      {
        dependencies: {[`private-package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        // Rejected by 401 error from registry so no validation on the error message
        await expect(run(`install`)).rejects.toThrow();
      },
    ),
  );

  test(
    `it should fail to install scoped packages which require authentication if no authentication is configured`,
    makeTemporaryEnv(
      {
        dependencies: {[`@private/package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        // Rejected by 401 error from registry so no validation on the error message
        await expect(run(`install`)).rejects.toThrow();
      },
    ),
  );

  test(
    `it should fail to install packages which if npmAlwaysAuth is set to true without auth present`,
    makeTemporaryEnv(
      {
        dependencies: {[`no-deps`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `npmAlwaysAuth: true\n`);

        await expect(run(`install`)).rejects.toThrowError(/No authentication configured for request/);
      },
    ),
  );

  test(
    `it should fail to install unscoped packages which require authentication if an authentication token is configured but always-auth is false`,
    makeTemporaryEnv(
      {
        dependencies: {[`private-package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `npmAuthToken: "${AUTH_TOKEN}"\n`);

        // Rejected by 401 error from registry so no validation on the error message
        await expect(run(`install`)).rejects.toThrow();
      },
    ),
  );

  test(
    `it should install scoped packages which require authentication if an authentication token is configured`,
    makeTemporaryEnv(
      {
        dependencies: {[`@private/package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `npmAuthToken: "${AUTH_TOKEN}"\n`);

        await run(`install`);

        await expect(source(`require('@private/package')`)).resolves.toMatchObject({
          name: `@private/package`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should install scoped packages which require authentication if an authentication token is configured at the scope level`,
    makeTemporaryEnv(
      {
        dependencies: {[`@private/package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        const url = await startPackageServer();

        await writeFile(`${path}/.yarnrc.yml`, [
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
    `it should install unscoped packages which require authentication if npmAlwaysAuth is set to true and an authentication token is present`,
    makeTemporaryEnv(
      {
        dependencies: {[`private-package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `npmAuthToken: "${AUTH_TOKEN}"\nnpmAlwaysAuth: true\n`);

        await run(`install`);

        await expect(source(`require('private-package')`)).resolves.toMatchObject({
          name: `private-package`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should fail to install unscoped packages which require authentication if an authentication ident is configured but always-auth is false`,
    makeTemporaryEnv(
      {
        dependencies: {[`private-package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `npmAuthIdent: "${AUTH_IDENT}"\n`);

        // Rejected by 401 error from registry so no validation on the error message
        await expect(run(`install`)).rejects.toThrow();
      },
    ),
  );

  test(
    `it should install scoped packages which require authentication if an authentication ident is configured`,
    makeTemporaryEnv(
      {
        dependencies: {[`@private/package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `npmAuthIdent: "${AUTH_IDENT}"\n`);

        await run(`install`);

        await expect(source(`require('@private/package')`)).resolves.toMatchObject({
          name: `@private/package`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should install scoped packages which require authentication if an authentication ident is configured at the scope level`,
    makeTemporaryEnv(
      {
        dependencies: {[`@private/package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        const url = await startPackageServer();

        await writeFile(`${path}/.yarnrc.yml`, [
          `npmScopes:`,
          `  private:`,
          `    npmRegistryServer: "${url}"`,
          `    npmAuthIdent: ${AUTH_IDENT}`,
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
    `it should normalize registries url keys`,
    makeTemporaryEnv(
      {
        dependencies: {[`@private/package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        const url = await startPackageServer();

        await writeFile(`${path}/.yarnrc.yml`, [
          `npmScopes:`,
          `  private:`,
          `    npmRegistryServer: "${url}"`,
          `npmRegistries:`,
          `  "${url}/":`,  // Testing the trailing `/`
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
    `it should install unscoped packages which require authentication if npmAlwaysAuth is set to true and an authentication ident is present`,
    makeTemporaryEnv(
      {
        dependencies: {[`private-package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `npmAuthIdent: "${AUTH_IDENT}"\nnpmAlwaysAuth: true\n`);

        await run(`install`);

        await expect(source(`require('private-package')`)).resolves.toMatchObject({
          name: `private-package`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should install unconventional scoped packages which require authentication if an authentication token is configured`,
    makeTemporaryEnv(
      {
        dependencies: {[`@private/unconventional-tarball`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `npmAuthToken: "${AUTH_TOKEN}"\n`);

        await run(`install`);

        await expect(source(`require('@private/unconventional-tarball')`)).resolves.toMatchObject({
          name: `@private/unconventional-tarball`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should install unconventional scoped packages which require authentication if npmAlwaysAuth is set to true and an authentication ident is present`,
    makeTemporaryEnv(
      {
        dependencies: {[`@private/unconventional-tarball`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `npmAuthIdent: "${AUTH_IDENT}"\nnpmAlwaysAuth: true\n`);

        await run(`install`);

        await expect(source(`require('@private/unconventional-tarball')`)).resolves.toMatchObject({
          name: `@private/unconventional-tarball`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should install unconventional unscoped packages which require authentication if npmAlwaysAuth is set to true and an authentication ident is present`,
    makeTemporaryEnv(
      {
        dependencies: {[`private-unconventional-tarball`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `npmAuthIdent: "${AUTH_IDENT}"\nnpmAlwaysAuth: true\n`);

        await run(`install`);

        await expect(source(`require('private-unconventional-tarball')`)).resolves.toMatchObject({
          name: `private-unconventional-tarball`,
          version: `1.0.0`,
        });
      },
    ),
  );

  test(
    `it should fail when an invalid authenticaation token is used`,
    makeTemporaryEnv(
      {
        dependencies: {[`private-package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `npmAuthToken: "${INVALID_AUTH_TOKEN}"\nnpmAlwaysAuth: true\n`);

        await expect(run(`install`)).rejects.toThrow();
      },
    ),
  );

  test(
    `it should fail when an invalid authentication ident is used`,
    makeTemporaryEnv(
      {
        dependencies: {[`private-package`]: `1.0.0`},
      },
      async ({path, run, source}) => {
        await writeFile(`${path}/.yarnrc.yml`, `npmAuthIdent: "${INVALID_AUTH_IDENT}"\nnpmAlwaysAuth: true\n`);

        await expect(run(`install`)).rejects.toThrow();
      },
    ),
  );
});

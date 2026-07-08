jest.mock(`../sources/npmHttpUtils`, () => ({
  getPackageMetadata: jest.fn(),
}));

import {structUtils} from '@yarnpkg/core';

const {NpmSemverResolver}: typeof import('../sources/NpmSemverResolver') = require(`../sources/NpmSemverResolver`);
const npmHttpUtils: typeof import('../sources/npmHttpUtils') = require(`../sources/npmHttpUtils`);

afterEach(() => {
  jest.clearAllMocks();
});

describe(`NpmSemverResolver`, () => {
  describe(`getSatisfying`, () => {
    it(`should match when the reference contains a __archiveUrl`, async () => {
      const resolver = new NpmSemverResolver();

      const ident = structUtils.makeIdent(null, `foo`);
      const descriptor = structUtils.makeDescriptor(ident, `npm:*`);
      const locator = structUtils.makeLocator(ident, `npm:1.0.0::__archiveUrl=foo.tgz`);

      const results = await resolver.getSatisfying(
        descriptor,
        {},
        [locator],
        null as any,
      );

      expect(results.locators.length).toEqual(1);
      expect(results.locators[0].locatorHash).toEqual(locator.locatorHash);
    });
  });

  describe(`resolve`, () => {
    const ident = structUtils.makeIdent(null, `native-package`);
    const nodeGypIdent = structUtils.makeIdent(null, `node-gyp`);

    const makeResolveOptions = () => ({
      project: {
        configuration: {
          normalizeDependencyMap: (dependencies: Map<any, any>) => dependencies,
        },
      },
    } as any);

    const mockPackageMetadata = (scripts: Record<string, string>) => {
      const getPackageMetadata = npmHttpUtils.getPackageMetadata as jest.MockedFunction<typeof npmHttpUtils.getPackageMetadata>;

      getPackageMetadata.mockResolvedValue({
        versions: {
          [`1.0.0`]: {
            name: structUtils.stringifyIdent(ident),
            version: `1.0.0`,
            scripts,
          },
        },
      } as any);
    };

    it(`shouldn't inject node-gyp when only a non-build script uses it`, async () => {
      mockPackageMetadata({
        test: `node-gyp rebuild`,
      });

      const resolver = new NpmSemverResolver();
      const locator = structUtils.makeLocator(ident, `npm:1.0.0`);

      const pkg = await resolver.resolve(locator, makeResolveOptions());

      expect(pkg.dependencies.has(nodeGypIdent.identHash)).toEqual(false);
    });

    it(`should inject node-gyp when an install script uses it`, async () => {
      mockPackageMetadata({
        install: `node-gyp rebuild`,
      });

      const resolver = new NpmSemverResolver();
      const locator = structUtils.makeLocator(ident, `npm:1.0.0`);

      const pkg = await resolver.resolve(locator, makeResolveOptions());

      expect(pkg.dependencies.has(nodeGypIdent.identHash)).toEqual(true);
    });

    it(`should inject node-gyp when an install script delegates to another script using it`, async () => {
      mockPackageMetadata({
        build: `node-gyp rebuild`,
        install: `yarn build`,
      });

      const resolver = new NpmSemverResolver();
      const locator = structUtils.makeLocator(ident, `npm:1.0.0`);

      const pkg = await resolver.resolve(locator, makeResolveOptions());

      expect(pkg.dependencies.has(nodeGypIdent.identHash)).toEqual(true);
    });
  });
});

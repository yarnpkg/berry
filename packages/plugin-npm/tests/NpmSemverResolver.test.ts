jest.mock(`../sources/npmHttpUtils`, () => ({
  getPackageMetadata: jest.fn(),
}));

import {semverUtils, structUtils} from '@yarnpkg/core';

const {NpmSemverResolver, selectMatchingVersions}: typeof import('../sources/NpmSemverResolver') = require(`../sources/NpmSemverResolver`);
const npmHttpUtils: typeof import('../sources/npmHttpUtils') = require(`../sources/npmHttpUtils`);

afterEach(() => {
  jest.clearAllMocks();
});

const select = (rangeString: string, versions: Array<string>) => {
  const range = semverUtils.validRange(rangeString);
  if (range === null)
    throw new Error(`Invalid range: ${rangeString}`);

  return selectMatchingVersions(range, versions).map(version => version.raw);
};

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

  describe(`selectMatchingVersions`, () => {
    it(`should match stable versions for "*" as usual`, () => {
      expect(select(`*`, [`1.0.0`, `1.1.0`, `2.0.0-rc.1`])).toEqual([`1.0.0`, `1.1.0`]);
    });

    it(`should fall back to prereleases for "*" when every version is a prerelease`, () => {
      expect(select(`*`, [`1.0.0-rc.1`, `1.0.0-rc.2`])).toEqual([`1.0.0-rc.1`, `1.0.0-rc.2`]);
    });

    it(`should not tolerate prereleases for ranges other than "*"`, () => {
      expect(select(`^1.0.0`, [`1.0.0-rc.1`, `1.0.0-rc.2`])).toEqual([]);
    });

    it(`should return nothing when there are no versions to match`, () => {
      expect(select(`*`, [])).toEqual([]);
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
  });
});

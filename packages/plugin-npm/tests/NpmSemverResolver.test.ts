import {semverUtils, structUtils}                  from '@yarnpkg/core';

import {NpmSemverResolver, selectMatchingVersions} from '../sources/NpmSemverResolver';

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
});

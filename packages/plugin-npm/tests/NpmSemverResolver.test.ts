import {structUtils}       from '@yarnpkg/core';

import {NpmSemverResolver} from '../sources/NpmSemverResolver';

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
});

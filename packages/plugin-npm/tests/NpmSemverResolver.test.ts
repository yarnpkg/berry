import {structUtils}       from '@yarnpkg/core';

import {NpmSemverResolver} from '../sources/NpmSemverResolver';

describe(`NpmSemverResolver`, () => {
  describe(`getSatisfying`, () => {
    it(`should match when the reference contains a __archiveUrl`, async () => {
      const resolver = new NpmSemverResolver();

      const reference = `npm:1.0.0::__archiveUrl=foo.tgz`;

      const results = await resolver.getSatisfying(
        structUtils.makeDescriptor(structUtils.makeIdent(null, `foo`), `*`),
        [reference],
        null as any,
      );

      expect(results.length).toEqual(1);
      expect(results[0].reference).toEqual(reference);
    });
  });
});

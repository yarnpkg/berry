import {structUtils}        from '@yarnpkg/core';

import {NpmTarballResolver} from '../sources/NpmTarballResolver';

describe(`NpmTarballResolver`, () => {
  describe(`supportsDescriptor`, () => {
    it(`should support npm descriptors with __archiveUrl parameters`, () => {
      const resolver = new NpmTarballResolver();
      const ident = structUtils.makeIdent(null, `test-package`);
      const descriptor = structUtils.makeDescriptor(ident, `npm:1.0.0::__archiveUrl=https://registry.example.org/test-package-1.0.0.tgz`);

      expect(resolver.supportsDescriptor(descriptor, null as any)).toBe(true);
    });

    it(`should not support npm descriptors without __archiveUrl parameters`, () => {
      const resolver = new NpmTarballResolver();
      const ident = structUtils.makeIdent(null, `test-package`);
      const descriptor = structUtils.makeDescriptor(ident, `npm:1.0.0`);

      expect(resolver.supportsDescriptor(descriptor, null as any)).toBe(false);
    });

    it(`should not support non-npm descriptors`, () => {
      const resolver = new NpmTarballResolver();
      const ident = structUtils.makeIdent(null, `test-package`);
      const descriptor = structUtils.makeDescriptor(ident, `file:./local-package.tgz`);

      expect(resolver.supportsDescriptor(descriptor, null as any)).toBe(false);
    });
  });

  describe(`supportsLocator`, () => {
    it(`should not support any locators (handled by NpmSemverResolver)`, () => {
      const resolver = new NpmTarballResolver();
      const ident = structUtils.makeIdent(null, `test-package`);
      const locator = structUtils.makeLocator(ident, `npm:1.0.0::__archiveUrl=https://registry.example.org/test-package-1.0.0.tgz`);

      expect(resolver.supportsLocator(locator, null as any)).toBe(false);
    });
  });

  describe(`getCandidates`, () => {
    it(`should convert descriptor to locator`, async () => {
      const resolver = new NpmTarballResolver();
      const ident = structUtils.makeIdent(null, `test-package`);
      const descriptor = structUtils.makeDescriptor(ident, `npm:1.0.0::__archiveUrl=https://registry.example.org/test-package-1.0.0.tgz`);

      const candidates = await resolver.getCandidates(descriptor, {}, null as any);

      expect(candidates.length).toBe(1);
      expect(candidates[0].identHash).toBe(descriptor.identHash);
    });
  });

  describe(`getSatisfying`, () => {
    it(`should filter locators that match the descriptor`, async () => {
      const resolver = new NpmTarballResolver();
      const ident = structUtils.makeIdent(null, `test-package`);
      const descriptor = structUtils.makeDescriptor(ident, `npm:1.0.0::__archiveUrl=https://registry.example.org/test-package-1.0.0.tgz`);
      const locator1 = structUtils.makeLocator(ident, `npm:1.0.0::__archiveUrl=https://registry.example.org/test-package-1.0.0.tgz`);
      const locator2 = structUtils.makeLocator(ident, `npm:2.0.0::__archiveUrl=https://registry.example.org/test-package-2.0.0.tgz`);

      const result = await resolver.getSatisfying(descriptor, {}, [locator1, locator2], null as any);

      expect(result.locators.length).toBe(1);
      expect(result.locators[0].locatorHash).toBe(locator1.locatorHash);
      expect(result.sorted).toBe(false);
    });
  });
});

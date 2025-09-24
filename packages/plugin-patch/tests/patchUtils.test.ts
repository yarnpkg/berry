import {structUtils, Package}                                                        from '@yarnpkg/core';
import {npath, PortablePath}                                                         from '@yarnpkg/fslib';
import * as querystring                                                              from 'querystring';

import {parseDescriptor, parseLocator, makeDescriptor, makeLocator, normalizeParams} from '../sources/patchUtils';

function createMockPackage(locator: any): Package {
  return {
    ...locator,
    version: `1.0.0`,
    languageName: `node` as const,
    linkType: `HARD` as const,
    dependencies: new Map(),
    peerDependencies: new Map(),
    dependenciesMeta: new Map(),
    peerDependenciesMeta: new Map(),
    bin: new Map(),
  };
}

describe(`patchUtils`, () => {
  describe(`normalizeParams`, () => {
    test(`should handle null params`, () => {
      const result = normalizeParams(null);
      expect(result).toEqual({});
    });

    test(`should handle undefined params`, () => {
      const result = normalizeParams(undefined);
      expect(result).toEqual({});
    });

    test(`should extract string parameters`, () => {
      const params = {
        __archiveUrl: `https://example.com/file.tgz`,
        version: `1.0.0`,
        someOtherParam: `value`,
      };
      const result = normalizeParams(params);

      expect(result).toEqual({
        __archiveUrl: `https://example.com/file.tgz`,
        version: `1.0.0`,
        someOtherParam: `value`,
      });
    });

    test(`should join array parameters with commas`, () => {
      const params = {
        tags: [`tag1`, `tag2`, `tag3`],
        single: `value`,
      };
      const result = normalizeParams(params);

      expect(result).toEqual({
        tags: `tag1,tag2,tag3`,
        single: `value`,
      });
    });

    test(`should omit undefined values`, () => {
      const params = {
        defined: `value`,
        undefined,
        alsoUndefined: undefined,
      };
      const result = normalizeParams(params);

      expect(result).toEqual({
        defined: `value`,
      });
    });

    test(`should handle mixed parameter types`, () => {
      const params = {
        stringParam: `string-value`,
        arrayParam: [`item1`, `item2`],
        undefinedParam: undefined,
        emptyArrayParam: [],
      };
      const result = normalizeParams(params);

      expect(result).toEqual({
        stringParam: `string-value`,
        arrayParam: `item1,item2`,
      });
    });

    test(`should handle empty object`, () => {
      const result = normalizeParams({});
      expect(result).toEqual({});
    });

    test(`should preserve URL encoded values`, () => {
      const params = {
        __archiveUrl: `https%3A%2F%2Fexample.com%2Ffile.tgz`,
        encodedParam: `value%20with%20spaces`,
      };
      const result = normalizeParams(params);

      expect(result).toEqual({
        __archiveUrl: `https%3A%2F%2Fexample.com%2Ffile.tgz`,
        encodedParam: `value%20with%20spaces`,
      });
    });

    test(`should behave consistently with Node's querystring.stringify`, () => {
      const testCase = {empty: ``, emptyArray: [], nonEmpty: [`a`, `b`]};

      const customResult = normalizeParams(testCase);
      const stringified = querystring.stringify(testCase);
      const parsed = querystring.parse(stringified);

      expect(customResult).toEqual({
        empty: ``,
        nonEmpty: `a,b`,
      });

      const expectedFromNode: {[key: string]: string} = {};
      for (const [key, value] of Object.entries(parsed)) {
        if (typeof value === `string`) {
          expectedFromNode[key] = value;
        } else if (Array.isArray(value)) {
          expectedFromNode[key] = value.join(`,`);
        }
      }
      expect(customResult).toEqual(expectedFromNode);
    });
  });

  describe(`parseDescriptor`, () => {
    test(`should parse basic patch descriptor correctly`, () => {
      const descriptor = structUtils.parseDescriptor(`test@patch:no-deps@npm:1.0.0#~/.yarn/patches/no-deps-npm-1.0.0-abc123.patch`);
      const result = parseDescriptor(descriptor);

      expect(result.sourceDescriptor.scope).toBe(null);
      expect(result.sourceDescriptor.name).toBe(`no-deps`);
      expect(result.sourceDescriptor.range).toBe(`npm:1.0.0`);
      expect(result.patchPaths).toEqual([npath.toPortablePath(`~/.yarn/patches/no-deps-npm-1.0.0-abc123.patch`)]);
      expect(result.parentLocator).toBe(null);
      expect(result.sourceVersion).toBe(null);
    });

    test(`should extract patch-specific parameters from patch descriptor`, () => {
      const descriptor = structUtils.parseDescriptor(
        `test@patch:pkg@npm:1.0.0#patch.patch::version=1.0.0&hash=abc123&locator=parent%40workspace%3A.`,
      );
      const result = parseDescriptor(descriptor);

      expect(result.sourceDescriptor.name).toBe(`pkg`);
      expect(result.sourceDescriptor.range).toBe(`npm:1.0.0`);
      expect(result.sourceVersion).toBe(`1.0.0`);
      expect(result.parentLocator).not.toBe(null);
      expect(result.parentLocator?.name).toBe(`parent`);
    });
  });

  describe(`makeDescriptor and parseDescriptor round-trip`, () => {
    test(`should preserve source parameters through round-trip`, () => {
      const sourceDescriptor = structUtils.parseDescriptor(
        `unconventional-tarball@npm:1.0.0::__archiveUrl=https%3A%2F%2Fregistry.example.org%2Ffile.tgz`,
      );
      const ident = structUtils.parseIdent(`test`);
      const patchPaths = [npath.toPortablePath(`~/.yarn/patches/file.patch`)];

      const patchDescriptor = makeDescriptor(ident, {
        parentLocator: null,
        sourceDescriptor,
        patchPaths,
      });

      const parsed = parseDescriptor(patchDescriptor);
      expect(parsed.sourceDescriptor.range).toContain(`__archiveUrl=https%3A%2F%2Fregistry.example.org%2Ffile.tgz`);
      expect(parsed.patchPaths).toEqual(patchPaths);
    });

    test(`should handle standard packages without extra parameters`, () => {
      const sourceDescriptor = structUtils.parseDescriptor(`no-deps@npm:1.0.0`);
      const ident = structUtils.parseIdent(`test`);
      const patchPaths = [npath.toPortablePath(`~/.yarn/patches/file.patch`)];

      const patchDescriptor = makeDescriptor(ident, {
        parentLocator: null,
        sourceDescriptor,
        patchPaths,
      });

      const parsed = parseDescriptor(patchDescriptor);

      expect(parsed.sourceDescriptor.range).toBe(`npm:1.0.0`);
      expect(parsed.patchPaths).toEqual(patchPaths);
    });
  });

  describe(`makeLocator and parseLocator round-trip`, () => {
    test(`should preserve source parameters in locators through round-trip`, () => {
      const sourcePackage = structUtils.makeLocator(
        structUtils.parseIdent(`unconventional-tarball`),
        `npm:1.0.0::__archiveUrl=https%3A%2F%2Fregistry.example.org%2Ffile.tgz`,
      );
      const ident = structUtils.parseIdent(`test`);
      const patchPaths = [npath.toPortablePath(`~/.yarn/patches/file.patch`)];

      const patchLocator = makeLocator(ident, {
        parentLocator: null,
        sourcePackage: createMockPackage(sourcePackage),
        patchPaths,
        patchHash: `abc123`,
      });

      const parsed = parseLocator(patchLocator);
      expect(parsed.sourceLocator.reference).toContain(`__archiveUrl=https%3A%2F%2Fregistry.example.org%2Ffile.tgz`);
      expect(parsed.patchPaths).toEqual(patchPaths);
      expect(parsed.sourceVersion).toBe(`1.0.0`);
    });
  });

  describe(`parameter separation and preservation`, () => {
    test(`should separate patch parameters from source parameters`, () => {
      const descriptor = structUtils.parseDescriptor(
        `test@patch:pkg@npm:1.0.0#patch.patch::__archiveUrl=https%3A%2F%2Fexample.com&version=1.0.0&hash=abc123`,
      );
      const parsed = parseDescriptor(descriptor);

      expect(parsed.sourceDescriptor.range).toContain(`__archiveUrl=https%3A%2F%2Fexample.com`);
      expect(parsed.sourceDescriptor.range).not.toContain(`version=1.0.0`);
      expect(parsed.sourceDescriptor.range).not.toContain(`hash=abc123`);
      expect(parsed.sourceVersion).toBe(`1.0.0`);
    });

    test(`should maintain correct format for patch URLs`, () => {
      const sourceDescriptor = structUtils.parseDescriptor(
        `pkg@npm:1.0.0::__archiveUrl=https%3A%2F%2Fexample.com`,
      );
      const ident = structUtils.parseIdent(`test`);
      const patchPaths = [npath.toPortablePath(`patch.patch`)];

      const result = makeDescriptor(ident, {
        parentLocator: null,
        sourceDescriptor,
        patchPaths,
      });

      expect(result.range).toMatch(/^patch:[^#]*#[^:]*::/);
      expect(result.range).not.toMatch(/^patch:[^#]*::[^#]*#/);
    });
  });

  describe(`patch path handling`, () => {
    test(`should handle multiple patch paths`, () => {
      const sourceDescriptor = structUtils.parseDescriptor(`pkg@npm:1.0.0`);
      const ident = structUtils.parseIdent(`test`);
      const patchPaths = [
        npath.toPortablePath(`patch1.patch`),
        npath.toPortablePath(`patch2.patch`),
      ];

      const patchDescriptor = makeDescriptor(ident, {
        parentLocator: null,
        sourceDescriptor,
        patchPaths,
      });

      const parsed = parseDescriptor(patchDescriptor);
      expect(parsed.patchPaths).toEqual(patchPaths);
    });

    test(`should handle empty patch paths`, () => {
      const sourceDescriptor = structUtils.parseDescriptor(`pkg@npm:1.0.0`);
      const ident = structUtils.parseIdent(`test`);
      const patchPaths: Array<PortablePath> = [];

      const patchDescriptor = makeDescriptor(ident, {
        parentLocator: null,
        sourceDescriptor,
        patchPaths,
      });

      const parsed = parseDescriptor(patchDescriptor);
      expect(parsed.patchPaths).toEqual([]);
    });
  });

  test(`should handle multiple parameter types with parent locator`, () => {
    const sourceDescriptor = structUtils.parseDescriptor(
      `pkg@npm:1.0.0::__archiveUrl=https%3A%2F%2Fexample.com%2Ffile.tgz&otherParam=value`,
    );
    const parentLocator = structUtils.parseLocator(`workspace@workspace:.`);
    const ident = structUtils.parseIdent(`test`);
    const patchPaths = [npath.toPortablePath(`patch.patch`)];

    const patchDescriptor = makeDescriptor(ident, {
      parentLocator,
      sourceDescriptor,
      patchPaths,
    });

    const parsed = parseDescriptor(patchDescriptor);

    expect(parsed.sourceDescriptor.range).toContain(`__archiveUrl=https%3A%2F%2Fexample.com%2Ffile.tgz`);
    expect(parsed.sourceDescriptor.range).toContain(`otherParam=value`);
    expect(parsed.parentLocator?.name).toBe(`workspace`);
  });
});

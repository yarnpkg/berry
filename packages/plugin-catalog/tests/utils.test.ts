import {Configuration, Project, structUtils, ReportError}                          from '@yarnpkg/core';
import {PortablePath, xfs, ppath, Filename}                                        from '@yarnpkg/fslib';

import {isCatalogReference, getCatalogReferenceName, resolveDescriptorFromCatalog} from '../sources/utils';

describe(`utils`, () => {
  describe(`isCatalogReference`, () => {
    it(`should return true for ranges starting with catalog prefix`, () => {
      expect(isCatalogReference(`catalog:`)).toBe(true);
      expect(isCatalogReference(`catalog:some-reference`)).toBe(true);
      expect(isCatalogReference(`catalog:@scope/package`)).toBe(true);
    });

    it(`should return false for ranges not starting with catalog prefix`, () => {
      expect(isCatalogReference(`^1.0.0`)).toBe(false);
      expect(isCatalogReference(`npm:^1.0.0`)).toBe(false);
      expect(isCatalogReference(`file:./package`)).toBe(false);
      expect(isCatalogReference(`workspace:^`)).toBe(false);
      expect(isCatalogReference(``)).toBe(false);
      expect(isCatalogReference(`not-catalog:`)).toBe(false);
    });

    it(`should return false when range is not properly formatted`, () => {
      expect(isCatalogReference(`catalog`)).toBe(false);
      expect(isCatalogReference(`CATALOG:`)).toBe(false);
      expect(isCatalogReference(` catalog:`)).toBe(false);
    });
  });

  describe(`getCatalogReferenceName`, () => {
    it(`should return the reference name when provided`, () => {
      const descriptor = structUtils.makeDescriptor(
        structUtils.makeIdent(null, `test-package`),
        `catalog:my-reference`,
      );
      expect(getCatalogReferenceName(descriptor)).toBe(`my-reference`);
    });

    it(`should return package name when no reference name is provided`, () => {
      const descriptor = structUtils.makeDescriptor(
        structUtils.makeIdent(null, `test-package`),
        `catalog:`,
      );
      expect(getCatalogReferenceName(descriptor)).toBe(`test-package`);
    });

    it(`should handle reference names with special characters`, () => {
      const descriptor = structUtils.makeDescriptor(
        structUtils.makeIdent(null, `test-package`),
        `catalog:my-ref_with.special-chars`,
      );
      expect(getCatalogReferenceName(descriptor)).toBe(`my-ref_with.special-chars`);
    });
  });

  describe(`resolveDescriptorFromCatalog`, () => {
    let tmpDir: PortablePath;
    let configuration: Configuration;
    let project: Project;

    beforeEach(async () => {
      tmpDir = await xfs.mktempPromise();

      // Create a basic package.json
      await xfs.writeJsonPromise(ppath.join(tmpDir, Filename.manifest), {
        name: `test-project`,
        version: `1.0.0`,
      });

      configuration = Configuration.create(tmpDir, tmpDir, new Map());

      const {project: foundProject} = await Project.find(configuration, tmpDir);
      project = foundProject;
    });

    it(`should resolve descriptor from catalog when entry exists`, () => {
      // Set up catalog configuration
      const catalog = new Map([
        [`react`, `npm:^18.0.0`],
        [`lodash`, `npm:~4.17.21`],
      ]);
      configuration.values.set(`catalog`, catalog);

      const dependency = structUtils.makeDescriptor(
        structUtils.makeIdent(null, `react`),
        `catalog:react`,
      );

      const resolved = resolveDescriptorFromCatalog(project, dependency);

      expect(resolved.range).toBe(`npm:^18.0.0`);
      expect(structUtils.stringifyIdent(resolved)).toBe(`react`);
    });

    it(`should resolve descriptor using package name when no reference name is provided`, () => {
      const catalog = new Map([
        [`lodash`, `npm:~4.17.21`],
      ]);
      configuration.values.set(`catalog`, catalog);

      const dependency = structUtils.makeDescriptor(
        structUtils.makeIdent(null, `lodash`),
        `catalog:`,
      );

      const resolved = resolveDescriptorFromCatalog(project, dependency);

      expect(resolved.range).toBe(`npm:~4.17.21`);
      expect(structUtils.stringifyIdent(resolved)).toBe(`lodash`);
    });

    it(`should normalize the resolved descriptor`, () => {
      const catalog = new Map([
        [`typescript`, `^5.0.0`],
      ]);
      configuration.values.set(`catalog`, catalog);

      // Mock the normalizeDependency function to test it's called
      const originalNormalize = configuration.normalizeDependency;
      const normalizeSpy = jest.fn(originalNormalize.bind(configuration));
      configuration.normalizeDependency = normalizeSpy;

      const dependency = structUtils.makeDescriptor(
        structUtils.makeIdent(null, `typescript`),
        `catalog:typescript`,
      );

      const resolved = resolveDescriptorFromCatalog(project, dependency);

      expect(normalizeSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          range: `^5.0.0`,
        }),
      );

      expect(resolved.range).toBe(`npm:^5.0.0`);
    });

    it(`should throw ReportError when catalog is empty`, () => {
      configuration.values.set(`catalog`, new Map());

      const dependency = structUtils.makeDescriptor(
        structUtils.makeIdent(null, `react`),
        `catalog:react`,
      );

      expect(() => {
        resolveDescriptorFromCatalog(project, dependency);
      }).toThrow(ReportError);

      expect(() => {
        resolveDescriptorFromCatalog(project, dependency);
      }).toThrow(`catalog not found or empty`);
    });

    it(`should throw ReportError when catalog entry is not found`, () => {
      const catalog = new Map([
        [`lodash`, `~4.17.21`],
      ]);
      configuration.values.set(`catalog`, catalog);

      const dependency = structUtils.makeDescriptor(
        structUtils.makeIdent(null, `react`),
        `catalog:react`,
      );

      expect(() => {
        resolveDescriptorFromCatalog(project, dependency);
      }).toThrow(ReportError);
    });

    it(`should handle scoped packages in catalog`, () => {
      const catalog = new Map([
        [`node`, `^20.0.0`],
      ]);
      configuration.values.set(`catalog`, catalog);

      const dependency = structUtils.makeDescriptor(
        structUtils.makeIdent(`types`, `node`),
        `catalog:`,
      );

      const resolved = resolveDescriptorFromCatalog(project, dependency);

      expect(resolved.range).toBe(`npm:^20.0.0`);
      expect(structUtils.stringifyIdent(resolved)).toBe(`@types/node`);
    });

    it(`should handle different catalog reference names`, () => {
      const catalog = new Map([
        [`react`, `^19.0.0`],
        [`react-version`, `^18.0.0`],
        [`lodash`, `5.0.0`],
        [`legacy-lodash`, `4.17.20`],
      ]);
      configuration.values.set(`catalog`, catalog);

      const reactDependency = structUtils.makeDescriptor(
        structUtils.makeIdent(null, `react`),
        `catalog:react-version`,
      );

      const lodashDependency = structUtils.makeDescriptor(
        structUtils.makeIdent(null, `lodash`),
        `catalog:legacy-lodash`,
      );

      const resolvedReact = resolveDescriptorFromCatalog(project, reactDependency);
      const resolvedLodash = resolveDescriptorFromCatalog(project, lodashDependency);

      expect(resolvedReact.range).toBe(`npm:^18.0.0`);
      expect(structUtils.stringifyIdent(resolvedReact)).toBe(`react`);

      expect(resolvedLodash.range).toBe(`npm:4.17.20`);
      expect(structUtils.stringifyIdent(resolvedLodash)).toBe(`lodash`);
    });
  });
});

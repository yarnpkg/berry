import {Configuration, Project, structUtils, ReportError, Resolver, ResolveOptions, StreamReport} from '@yarnpkg/core';
import {PortablePath, xfs, ppath, Filename}                                                       from '@yarnpkg/fslib';

import {isCatalogReference, getCatalogName, getCatalogEntryName, resolveDescriptorFromCatalog}    from '../sources/utils';

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
      expect(isCatalogReference(`catalogs:`)).toBe(false);
      expect(isCatalogReference(`catalog`)).toBe(false);
      expect(isCatalogReference(`CATALOG:`)).toBe(false);
      expect(isCatalogReference(` catalog:`)).toBe(false);
    });
  });

  describe(`getCatalogName`, () => {
    it(`should return null when no reference name is provided`, () => {
      const descriptor = structUtils.makeDescriptor(
        structUtils.makeIdent(null, `test-package`),
        `catalog:`,
      );
      expect(getCatalogName(descriptor)).toBe(null);
    });

    it(`should return catalog name when reference name is provided`, () => {
      const descriptor = structUtils.makeDescriptor(
        structUtils.makeIdent(null, `test-package`),
        `catalog:react18`,
      );
      expect(getCatalogName(descriptor)).toBe(`react18`);
    });

    it(`should handle reference names with special characters`, () => {
      const descriptor = structUtils.makeDescriptor(
        structUtils.makeIdent(null, `test-package`),
        `catalog:my-ref_with.special-chars`,
      );
      expect(getCatalogName(descriptor)).toBe(`my-ref_with.special-chars`);
    });
  });

  describe(`getCatalogEntryName`, () => {
    it(`should return package name for non-scoped packages`, () => {
      const descriptor = structUtils.makeDescriptor(
        structUtils.makeIdent(null, `react`),
        `catalog:`,
      );
      expect(getCatalogEntryName(descriptor)).toBe(`react`);
    });

    it(`should return full scoped name for scoped packages`, () => {
      const descriptor = structUtils.makeDescriptor(
        structUtils.makeIdent(`types`, `node`),
        `catalog:`,
      );
      expect(getCatalogEntryName(descriptor)).toBe(`@types/node`);
    });
  });

  describe(`resolveDescriptorFromCatalog`, () => {
    let tmpDir: PortablePath;
    let configuration: Configuration;
    let project: Project;
    let mockResolver: jest.Mocked<Resolver>;
    let resolveOptions: ResolveOptions;

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

      // Create mock resolver with bindDescriptor method
      mockResolver = {
        bindDescriptor: jest.fn(descriptor => descriptor),
        supportsDescriptor: jest.fn(() => true),
      } as any;

      resolveOptions = {
        project,
        resolver: mockResolver,
        report: new StreamReport({stdout: process.stdout, configuration}),
      };
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
        `catalog:`,
      );

      const resolved = resolveDescriptorFromCatalog(project, dependency, mockResolver, resolveOptions);

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

      const resolved = resolveDescriptorFromCatalog(project, dependency, mockResolver, resolveOptions);

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
        `catalog:`,
      );

      const resolved = resolveDescriptorFromCatalog(project, dependency, mockResolver, resolveOptions);

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
        `catalog:`,
      );

      expect(() => {
        resolveDescriptorFromCatalog(project, dependency, mockResolver, resolveOptions);
      }).toThrow(ReportError);

      expect(() => {
        resolveDescriptorFromCatalog(project, dependency, mockResolver, resolveOptions);
      }).toThrow(`catalog not found or empty`);
    });

    it(`should throw ReportError when catalog entry is not found`, () => {
      const catalog = new Map([
        [`lodash`, `~4.17.21`],
      ]);
      configuration.values.set(`catalog`, catalog);

      const dependency = structUtils.makeDescriptor(
        structUtils.makeIdent(null, `react`),
        `catalog:`,
      );

      expect(() => {
        resolveDescriptorFromCatalog(project, dependency, mockResolver, resolveOptions);
      }).toThrow(ReportError);
    });

    it(`should handle scoped packages in catalog`, () => {
      const catalog = new Map([
        [`@types/node`, `^20.0.0`],
      ]);
      configuration.values.set(`catalog`, catalog);

      const dependency = structUtils.makeDescriptor(
        structUtils.makeIdent(`types`, `node`),
        `catalog:`,
      );

      const resolved = resolveDescriptorFromCatalog(project, dependency, mockResolver, resolveOptions);

      expect(resolved.range).toBe(`npm:^20.0.0`);
      expect(structUtils.stringifyIdent(resolved)).toBe(`@types/node`);
    });

    describe(`named catalogs`, () => {
      it(`should resolve descriptor from named catalog when entry exists`, () => {
        // Set up named catalogs configuration
        const catalogs = new Map([
          [`react18`, new Map([
            [`react`, `npm:^18.3.1`],
            [`react-dom`, `npm:^18.3.1`],
          ])],
          [`react17`, new Map([
            [`react`, `npm:^17.0.2`],
            [`react-dom`, `npm:^17.0.2`],
          ])],
        ]);
        configuration.values.set(`catalogs`, catalogs);

        const dependency = structUtils.makeDescriptor(
          structUtils.makeIdent(null, `react`),
          `catalog:react18`,
        );

        const resolved = resolveDescriptorFromCatalog(project, dependency, mockResolver, resolveOptions);

        expect(resolved.range).toBe(`npm:^18.3.1`);
        expect(structUtils.stringifyIdent(resolved)).toBe(`react`);
      });

      it(`should resolve descriptor from different named catalog`, () => {
        const catalogs = new Map([
          [`react18`, new Map([
            [`react`, `npm:^18.3.1`],
          ])],
          [`react17`, new Map([
            [`react`, `npm:^17.0.2`],
          ])],
        ]);
        configuration.values.set(`catalogs`, catalogs);

        const dependency = structUtils.makeDescriptor(
          structUtils.makeIdent(null, `react`),
          `catalog:react17`,
        );

        const resolved = resolveDescriptorFromCatalog(project, dependency, mockResolver, resolveOptions);

        expect(resolved.range).toBe(`npm:^17.0.2`);
        expect(structUtils.stringifyIdent(resolved)).toBe(`react`);
      });

      it(`should throw ReportError when named catalog does not exist`, () => {
        const catalogs = new Map([
          [`react18`, new Map([
            [`react`, `npm:^18.3.1`],
          ])],
        ]);
        configuration.values.set(`catalogs`, catalogs);

        const dependency = structUtils.makeDescriptor(
          structUtils.makeIdent(null, `react`),
          `catalog:nonexistent`,
        );

        expect(() => {
          resolveDescriptorFromCatalog(project, dependency, mockResolver, resolveOptions);
        }).toThrow(ReportError);

        expect(() => {
          resolveDescriptorFromCatalog(project, dependency, mockResolver, resolveOptions);
        }).toThrow(`catalog "nonexistent" not found or empty`);
      });

      it(`should throw ReportError when entry is not found in named catalog`, () => {
        const catalogs = new Map([
          [`react18`, new Map([
            [`react`, `npm:^18.3.1`],
          ])],
        ]);
        configuration.values.set(`catalogs`, catalogs);

        const dependency = structUtils.makeDescriptor(
          structUtils.makeIdent(null, `vue`),
          `catalog:react18`,
        );

        expect(() => {
          resolveDescriptorFromCatalog(project, dependency, mockResolver, resolveOptions);
        }).toThrow(ReportError);

        expect(() => {
          resolveDescriptorFromCatalog(project, dependency, mockResolver, resolveOptions);
        }).toThrow(`entry not found in catalog "react18"`);
      });

      it(`should work with both default and named catalogs simultaneously`, () => {
        // Set up both default and named catalogs
        const defaultCatalog = new Map([
          [`lodash`, `npm:^4.17.21`],
        ]);
        configuration.values.set(`catalog`, defaultCatalog);

        const catalogs = new Map([
          [`react18`, new Map([
            [`react`, `npm:^18.3.1`],
          ])],
        ]);
        configuration.values.set(`catalogs`, catalogs);

        // Test default catalog
        const defaultDependency = structUtils.makeDescriptor(
          structUtils.makeIdent(null, `lodash`),
          `catalog:`,
        );
        const defaultResolved = resolveDescriptorFromCatalog(project, defaultDependency, mockResolver, resolveOptions);
        expect(defaultResolved.range).toBe(`npm:^4.17.21`);

        // Test named catalog
        const namedDependency = structUtils.makeDescriptor(
          structUtils.makeIdent(null, `react`),
          `catalog:react18`,
        );
        const namedResolved = resolveDescriptorFromCatalog(project, namedDependency, mockResolver, resolveOptions);
        expect(namedResolved.range).toBe(`npm:^18.3.1`);
      });

      it(`should throw ReportError when catalogs configuration does not exist`, () => {
        // Don't set any catalogs configuration

        const dependency = structUtils.makeDescriptor(
          structUtils.makeIdent(null, `react`),
          `catalog:react18`,
        );

        expect(() => {
          resolveDescriptorFromCatalog(project, dependency, mockResolver, resolveOptions);
        }).toThrow(ReportError);

        expect(() => {
          resolveDescriptorFromCatalog(project, dependency, mockResolver, resolveOptions);
        }).toThrow(`catalog "react18" not found or empty`);
      });

      it(`should throw ReportError when named catalog is empty`, () => {
        const catalogs = new Map([
          [`empty`, new Map()],
        ]);
        configuration.values.set(`catalogs`, catalogs);

        const dependency = structUtils.makeDescriptor(
          structUtils.makeIdent(null, `react`),
          `catalog:empty`,
        );

        expect(() => {
          resolveDescriptorFromCatalog(project, dependency, mockResolver, resolveOptions);
        }).toThrow(ReportError);

        expect(() => {
          resolveDescriptorFromCatalog(project, dependency, mockResolver, resolveOptions);
        }).toThrow(`catalog "empty" not found or empty`);
      });
    });

    it(`should call bindDescriptor with normalized descriptor and return its result`, () => {
      const catalog = new Map([
        [`lodash`, `file:../packages/lodash`],
      ]);
      configuration.values.set(`catalog`, catalog);

      const dependency = structUtils.makeDescriptor(
        structUtils.makeIdent(null, `lodash`),
        `catalog:`,
      );

      // Mock bindDescriptor to return a modified descriptor
      const boundDescriptor = structUtils.makeDescriptor(
        structUtils.makeIdent(null, `lodash`),
        `file:/absolute/path/to/packages/lodash`,
      );
      mockResolver.bindDescriptor.mockReturnValue(boundDescriptor);

      const result = resolveDescriptorFromCatalog(project, dependency, mockResolver, resolveOptions);

      // Verify bindDescriptor was called with correct parameters
      expect(mockResolver.bindDescriptor).toHaveBeenCalledWith(
        expect.objectContaining({
          range: `file:../packages/lodash`,
        }),
        project.topLevelWorkspace.anchoredLocator,
        resolveOptions,
      );

      // Verify the result from bindDescriptor is returned
      expect(result).toBe(boundDescriptor);
      expect(result.range).toBe(`file:/absolute/path/to/packages/lodash`);
    });

    it(`should preserve resolver behavior when bindDescriptor modifies the descriptor`, () => {
      const catalog = new Map([
        [`@types/react`, `npm:^18.0.0`],
      ]);
      configuration.values.set(`catalog`, catalog);

      const dependency = structUtils.makeDescriptor(
        structUtils.makeIdent(`types`, `react`),
        `catalog:`,
      );

      // Mock bindDescriptor to simulate some transformation
      const modifiedDescriptor = structUtils.makeDescriptor(
        structUtils.makeIdent(`types`, `react`),
        `npm:^18.0.0-modified`,
      );
      mockResolver.bindDescriptor.mockReturnValue(modifiedDescriptor);

      const result = resolveDescriptorFromCatalog(project, dependency, mockResolver, resolveOptions);

      expect(mockResolver.bindDescriptor).toHaveBeenCalledTimes(1);
      expect(result).toBe(modifiedDescriptor);
      expect(result.range).toBe(`npm:^18.0.0-modified`);
    });
  });
});

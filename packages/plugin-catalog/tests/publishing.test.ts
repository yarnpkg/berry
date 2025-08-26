import {Configuration, Project, structUtils, Plugin} from '@yarnpkg/core';
import {PortablePath, xfs, ppath, Filename}          from '@yarnpkg/fslib';
import {packUtils}                                   from '@yarnpkg/plugin-pack';

import catalogPlugin                                 from '../sources/index';

describe(`Catalog publishing behavior`, () => {
  let tmpDir: PortablePath;
  let configuration: Configuration;
  let project: Project;

  beforeEach(async () => {
    tmpDir = await xfs.mktempPromise();

    // Create a workspace structure
    await xfs.writeJsonPromise(ppath.join(tmpDir, Filename.manifest), {
      name: `test-workspace`,
      version: `1.0.0`,
      workspaces: [`packages/*`],
    });

    const packageDir = ppath.join(tmpDir, `packages`, `test-package`);
    await xfs.mkdirpPromise(packageDir);

    // Create a package with catalog dependencies
    await xfs.writeJsonPromise(ppath.join(packageDir, Filename.manifest), {
      name: `@test/package`,
      version: `1.0.0`,
      dependencies: {
        react: `catalog:`,
        vue: `catalog:vue3`,
        lodash: `catalog:`,
      },
      devDependencies: {
        typescript: `catalog:`,
        eslint: `catalog:linting`,
      },
      peerDependencies: {
        rxjs: `catalog:rx`,
      },
    });

    // Create plugins map with catalog plugin
    const plugins = new Map<string, Plugin<any>>();
    plugins.set(`catalog`, catalogPlugin);

    configuration = Configuration.create(tmpDir, tmpDir, plugins);

    // Set up catalog configuration directly
    const defaultCatalog = new Map([
      [`react`, `^18.3.1`],
      [`lodash`, `^4.17.21`],
      [`typescript`, `~5.2.0`],
    ]);
    configuration.values.set(`catalog`, defaultCatalog);

    const namedCatalogs = new Map([
      [`vue3`, new Map([
        [`vue`, `^3.4.0`],
      ])],
      [`linting`, new Map([
        [`eslint`, `^8.57.0`],
      ])],
      [`rx`, new Map([
        [`rxjs`, `^7.8.0`],
      ])],
    ]);
    configuration.values.set(`catalogs`, namedCatalogs);

    const {project: foundProject} = await Project.find(configuration, tmpDir);
    project = foundProject;
  });

  afterEach(async () => {
    await xfs.removePromise(tmpDir);
  });

  it(`should replace catalog: protocol with actual version ranges during packaging`, async () => {
    // Find the test package workspace
    const workspace = project.getWorkspaceByIdent(structUtils.makeIdent(`test`, `package`));

    if (!workspace)
      throw new Error(`Test workspace not found`);


    // Generate the package manifest (this is what gets published)
    const publishedManifest = await packUtils.genPackageManifest(workspace);
    const publishedDeps = (publishedManifest as any);

    // Verify that catalog: protocol has been replaced with actual version ranges
    expect(publishedDeps.dependencies.react).toBe(`npm:^18.3.1`);
    expect(publishedDeps.dependencies.vue).toBe(`npm:^3.4.0`);
    expect(publishedDeps.dependencies.lodash).toBe(`npm:^4.17.21`);

    expect(publishedDeps.devDependencies.typescript).toBe(`npm:~5.2.0`);
    expect(publishedDeps.devDependencies.eslint).toBe(`npm:^8.57.0`);

    expect(publishedDeps.peerDependencies.rxjs).toBe(`npm:^7.8.0`);


    // Verify that no catalog: protocol remains
    const allDeps = {
      ...publishedDeps.dependencies,
      ...publishedDeps.devDependencies,
      ...publishedDeps.peerDependencies,
    };

    for (const [, depRange] of Object.entries(allDeps)) {
      expect(typeof depRange).toBe(`string`);
      expect((depRange as string).startsWith(`catalog:`)).toBe(false);
    }
  });

  it(`should handle packages without catalog dependencies`, async () => {
    // Create a package without catalog dependencies
    const noCatalogDir = ppath.join(tmpDir, `packages`, `no-catalog`);
    await xfs.mkdirpPromise(noCatalogDir);

    await xfs.writeJsonPromise(ppath.join(noCatalogDir, Filename.manifest), {
      name: `@test/no-catalog`,
      version: `1.0.0`,
      dependencies: {
        react: `^17.0.0`,
        lodash: `~4.16.0`,
      },
    });

    // Re-find the project to include the new package
    const {project: updatedProject} = await Project.find(configuration, tmpDir);
    const workspace = updatedProject.getWorkspaceByIdent(structUtils.makeIdent(`test`, `no-catalog`));

    if (!workspace)
      throw new Error(`No-catalog workspace not found`);


    const publishedManifest = await packUtils.genPackageManifest(workspace);
    const publishedDeps = (publishedManifest as any);

    // Verify that regular version ranges are unchanged
    expect(publishedDeps.dependencies.react).toBe(`^17.0.0`);
    expect(publishedDeps.dependencies.lodash).toBe(`~4.16.0`);
  });

  it(`should handle packages with mixed catalog and regular dependencies`, async () => {
    // Create a package with mixed dependencies
    const mixedDir = ppath.join(tmpDir, `packages`, `mixed-deps`);
    await xfs.mkdirpPromise(mixedDir);

    await xfs.writeJsonPromise(ppath.join(mixedDir, Filename.manifest), {
      name: `@test/mixed-deps`,
      version: `1.0.0`,
      dependencies: {
        react: `catalog:`,           // From catalog
        express: `^4.18.0`,         // Regular version
        vue: `catalog:vue3`,        // From named catalog
        moment: `>=2.29.0 <3.0.0`,  // Complex version range
      },
    });

    // Re-find the project to include the new package
    const {project: updatedProject} = await Project.find(configuration, tmpDir);
    const workspace = updatedProject.getWorkspaceByIdent(structUtils.makeIdent(`test`, `mixed-deps`));

    if (!workspace)
      throw new Error(`Mixed-deps workspace not found`);


    const publishedManifest = await packUtils.genPackageManifest(workspace);
    const publishedDeps = (publishedManifest as any);

    // Catalog dependencies should be resolved
    expect(publishedDeps.dependencies.react).toBe(`npm:^18.3.1`);
    expect(publishedDeps.dependencies.vue).toBe(`npm:^3.4.0`);

    // Regular dependencies should remain unchanged
    expect(publishedDeps.dependencies.express).toBe(`^4.18.0`);
    expect(publishedDeps.dependencies.moment).toBe(`>=2.29.0 <3.0.0`);
  });

  it(`should gracefully handle missing catalog entries`, async () => {
    // Create a package with missing catalog entry
    const missingDir = ppath.join(tmpDir, `packages`, `missing-catalog`);
    await xfs.mkdirpPromise(missingDir);

    await xfs.writeJsonPromise(ppath.join(missingDir, Filename.manifest), {
      name: `@test/missing-catalog`,
      version: `1.0.0`,
      dependencies: {
        react: `catalog:`,              // Valid entry
        nonexistent: `catalog:missing`, // Invalid named catalog
        missing: `catalog:`,            // Missing entry in default catalog
      },
    });

    // Re-find the project to include the new package
    const {project: updatedProject} = await Project.find(configuration, tmpDir);
    const workspace = updatedProject.getWorkspaceByIdent(structUtils.makeIdent(`test`, `missing-catalog`));

    if (!workspace)
      throw new Error(`Missing-catalog workspace not found`);


    const publishedManifest = await packUtils.genPackageManifest(workspace);
    const publishedDeps = (publishedManifest as any);

    // Valid catalog entry should be resolved
    expect(publishedDeps.dependencies.react).toBe(`npm:^18.3.1`);

    // Invalid entries should remain as catalog: references
    // This allows the error to be caught during normal resolution
    expect(publishedDeps.dependencies.nonexistent).toBe(`catalog:missing`);
    expect(publishedDeps.dependencies.missing).toBe(`catalog:`);
  });

  it(`should handle scoped package names in catalogs`, async () => {
    // Update catalog configuration for scoped packages
    // Note: For scoped packages like @types/node, the catalog key should be just the package name "node"
    const scopedDefaultCatalog = new Map([
      [`react`, `^18.3.1`],
      [`node`, `^20.0.0`],      // @types/node -> node
      [`core`, `^7.24.0`],      // @babel/core -> core
    ]);
    configuration.values.set(`catalog`, scopedDefaultCatalog);

    const scopedNamedCatalogs = new Map([
      [`types`, new Map([
        [`react`, `^18.2.0`],   // @types/react -> react
        [`lodash`, `^4.14.0`],  // @types/lodash -> lodash
      ])],
    ]);
    configuration.values.set(`catalogs`, scopedNamedCatalogs);

    // Create a package with scoped dependencies
    const scopedDir = ppath.join(tmpDir, `packages`, `scoped-deps`);
    await xfs.mkdirpPromise(scopedDir);

    await xfs.writeJsonPromise(ppath.join(scopedDir, Filename.manifest), {
      name: `@test/scoped-deps`,
      version: `1.0.0`,
      dependencies: {
        react: `catalog:`,
        "@types/node": `catalog:`,
        "@babel/core": `catalog:`,
      },
      devDependencies: {
        "@types/react": `catalog:types`,
        "@types/lodash": `catalog:types`,
      },
    });

    // Re-find the project to include the new package
    const {project: updatedProject} = await Project.find(configuration, tmpDir);
    const workspace = updatedProject.getWorkspaceByIdent(structUtils.makeIdent(`test`, `scoped-deps`));

    if (!workspace)
      throw new Error(`Scoped-deps workspace not found`);


    const publishedManifest = await packUtils.genPackageManifest(workspace);
    const publishedDeps = (publishedManifest as any);

    // Verify scoped packages are properly resolved
    expect(publishedDeps.dependencies.react).toBe(`npm:^18.3.1`);
    expect(publishedDeps.dependencies[`@types/node`]).toBe(`npm:^20.0.0`);
    expect(publishedDeps.dependencies[`@babel/core`]).toBe(`npm:^7.24.0`);

    expect(publishedDeps.devDependencies[`@types/react`]).toBe(`npm:^18.2.0`);
    expect(publishedDeps.devDependencies[`@types/lodash`]).toBe(`npm:^4.14.0`);
  });
});

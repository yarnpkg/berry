import {Cache, Configuration, Project, ThrowReport, structUtils, LocatorHash, Package} from '@yarnpkg/core';
import {Filename, PortablePath, ppath, xfs}                                            from '@yarnpkg/fslib';
import LinkPlugin                                                                      from '@yarnpkg/plugin-link';
import PnpPlugin                                                                       from '@yarnpkg/plugin-pnp';
import v8                                                                              from 'v8';

import {TestPlugin}                                                                    from './TestPlugin';

const getConfiguration = (p: PortablePath) => {
  return Configuration.create(p, p, new Map([
    [`@yarnpkg/plugin-link`, LinkPlugin],
    [`@yarnpkg/plugin-pnp`, PnpPlugin],
    [`plugin-test`, TestPlugin],
  ]));
};

describe(`Project`, () => {
  it(`should resolve virtual links during 'resolveEverything'`, async () => {
    await xfs.mktempPromise(async dir => {
      await xfs.mkdirpPromise(ppath.join(dir, `foo` as Filename));
      await xfs.writeJsonPromise(ppath.join(dir, `foo` as Filename, Filename.manifest), {
        name: `foo`,
        peerDependencies: {
          [`bar`]: `*`,
        },
      });

      await xfs.mkdirpPromise(ppath.join(dir, `bar` as PortablePath));
      await xfs.writeJsonPromise(ppath.join(dir, `bar` as Filename, Filename.manifest), {
        name: `bar`,
      });

      await xfs.writeJsonPromise(ppath.join(dir, Filename.manifest), {
        dependencies: {
          [`foo`]: `portal:./foo`,
          [`bar`]: `portal:./bar`,
        },
      });

      // First we install the project; this will generate the lockfile yada yada
      {
        const configuration = await getConfiguration(dir);
        const {project} = await Project.find(configuration, dir);
        const cache = await Cache.find(configuration);

        await project.install({cache, report: new ThrowReport()});
      }

      // Then we do it again; if the virtual resolution succeeded, then the `foo` package should have a dependency on `bar`
      {
        const configuration = await getConfiguration(dir);
        const {project} = await Project.find(configuration, dir);

        await project.resolveEverything({
          lockfileOnly: true,
          report: new ThrowReport(),
        });

        const topLevelPkg = project.storedPackages.get(project.topLevelWorkspace.anchoredLocator.locatorHash)!;

        const fooIdent = structUtils.makeIdent(null, `foo`);
        const barIdent = structUtils.makeIdent(null, `bar`);

        const fooDescriptor = topLevelPkg.dependencies.get(fooIdent.identHash)!;
        const fooResolution = project.storedResolutions.get(fooDescriptor.descriptorHash)!;
        const fooPkg = project.storedPackages.get(fooResolution)!;

        expect(structUtils.isVirtualLocator(fooPkg)).toEqual(true);
        expect(fooPkg.dependencies.has(barIdent.identHash)).toEqual(true);
      }
    });
  });

  it(`should use the same descriptor as the one used by the ante-ancestor when a package peer-depends on its own parent`, async () => {
    // Note that the `xxx`/`yyy`/`zzz` names matter; due to the ordering detail mentioned
    // in https://github.com/yarnpkg/berry/pull/3565, we need the traversal to be in a
    // specific order for the test to have the correct result.

    await xfs.mktempPromise(async dir => {
      await xfs.mkdirpPromise(ppath.join(dir, `xxx` as Filename));
      await xfs.writeJsonPromise(ppath.join(dir, `xxx` as Filename, Filename.manifest), {
        name: `xxx`,
        dependencies: {
          [`yyy`]: `^1.0.0`,
        },
      });

      await xfs.mkdirpPromise(ppath.join(dir, `yyy` as PortablePath));
      await xfs.writeJsonPromise(ppath.join(dir, `yyy` as Filename, Filename.manifest), {
        name: `yyy`,
        version: `1.0.0`,
        dependencies: {
          [`zzz`]: `*`,
        },
      });

      await xfs.mkdirpPromise(ppath.join(dir, `zzz` as PortablePath));
      await xfs.writeJsonPromise(ppath.join(dir, `zzz` as Filename, Filename.manifest), {
        name: `zzz`,
        version: `1.0.0`,
        peerDependencies: {
          [`yyy`]: `*`,
        },
      });

      await xfs.writeJsonPromise(ppath.join(dir, Filename.manifest), {
        workspaces: [`xxx`, `yyy`, `zzz`],
      });

      const configuration = await getConfiguration(dir);
      const {project} = await Project.find(configuration, dir);
      const cache = await Cache.find(configuration);

      await project.install({cache, report: new ThrowReport()});

      const xxx = project.getWorkspaceByIdent(structUtils.makeIdent(null, `xxx`));

      const yyyDescriptor = xxx.dependencies.get(structUtils.makeIdent(null, `yyy`).identHash)!;
      const yyyResolution = project.storedResolutions.get(yyyDescriptor.descriptorHash)!;
      const yyy = project.storedPackages.get(yyyResolution)!;

      const zzzDescriptor = yyy.dependencies.get(structUtils.makeIdent(null, `zzz`).identHash)!;
      const zzzResolution = project.storedResolutions.get(zzzDescriptor.descriptorHash)!;
      const zzz = project.storedPackages.get(zzzResolution)!;

      const ident = structUtils.makeIdent(null, `yyy`);
      const expectedDescriptor = structUtils.makeDescriptor(ident, `^1.0.0`);

      // This one is a sanity check
      expect(xxx.dependencies.get(ident.identHash)).toEqual(expectedDescriptor);

      // This one is the real check
      expect(zzz.dependencies.get(ident.identHash)).toEqual(expectedDescriptor);
    });
  });

  it(`should generate the exact same structure with a full resolveEverything as hydrateVirtualPackages`, async () => {
    await xfs.mktempPromise(async dir => {
      await xfs.mkdirpPromise(ppath.join(dir, `foo` as Filename));
      await xfs.writeJsonPromise(ppath.join(dir, `foo` as Filename, Filename.manifest), {
        name: `foo`,
        peerDependencies: {
          [`bar`]: `*`,
        },
      });

      await xfs.mkdirpPromise(ppath.join(dir, `bar` as PortablePath));
      await xfs.writeJsonPromise(ppath.join(dir, `bar` as Filename, Filename.manifest), {
        name: `bar`,
      });

      await xfs.writeJsonPromise(ppath.join(dir, Filename.manifest), {
        dependencies: {
          [`foo`]: `portal:./foo`,
          [`bar`]: `portal:./bar`,
        },
      });

      let project1: Project;
      let project2: Project;

      // First we install the project; this will generate the lockfile yada yada
      {
        const configuration = await getConfiguration(dir);
        const {project} = await Project.find(configuration, dir);
        const cache = await Cache.find(configuration);

        await project.install({cache, report: new ThrowReport()});

        project1 = project;
      }

      // Then we setup the project except that this time we only call `hydrateVirtualPackages`
      {
        const configuration = await getConfiguration(dir);
        const {project} = await Project.find(configuration, dir);

        await project.restoreInstallState();

        project2 = project;
      }

      // We remove the "version" field from all pkgs, because they contain
      // invalid data when calling the resolution through the lockfileOnly
      // mode (which is what hydrateVirtualPackage does, in part).
      //
      // This discrepancy is expected, because we don't want to store the real
      // version number inside the lockfile for developer experience purposes
      // (otherwise our users would need to run `yarn install` again each time
      // they change the version from one of their workspaces / portals).
      const clean = (registry: Map<LocatorHash, Package>) => {
        return new Map([...registry.values()].map(pkg => {
          return [pkg.locatorHash, {...pkg, version: null}];
        }));
      };

      // Jest does a lot of magic with global values and comparisons. One of
      // them is seemingly to inject special Map/Set constructors. Since the
      // v8.deserialize function reconstructs data using its own copy of the
      // constructor (which doesn't match the one provided by Jest), the
      // toEqual comparison crashes.
      //
      // This fixes the problem by making sure that both input and expected
      // output go through the same constructors (ie the v8 ones).
      const fixPrototypes = (data: unknown) => v8.deserialize(v8.serialize(data));

      expect(fixPrototypes({
        lockfileChecksum: project1.lockFileChecksum,
        packages: clean(project1.storedPackages),
        descriptors: project1.storedDescriptors,
        resolutions: project1.storedResolutions,
      })).toEqual(fixPrototypes({
        lockfileChecksum: project2.lockFileChecksum,
        packages: clean(project2.storedPackages),
        descriptors: project2.storedDescriptors,
        resolutions: project2.storedResolutions,
      }));
    });
  });

  it(`should update Manifest.raw when persisting a workspace`, async () => {
    await xfs.mktempPromise(async path => {
      await xfs.writeJsonPromise(ppath.join(path, Filename.manifest), {name: `foo`});
      await xfs.writeFilePromise(ppath.join(path, Filename.lockfile), ``);

      const configuration = getConfiguration(path);
      const {project} = await Project.find(configuration, path);

      expect(project.topLevelWorkspace.manifest.raw.main).toBeUndefined();

      project.topLevelWorkspace.manifest.main = `./index.js` as PortablePath;
      await project.topLevelWorkspace.persistManifest();
      expect(project.topLevelWorkspace.manifest.raw.main).toEqual(`./index.js`);
    });
  });

  // https://github.com/yarnpkg/berry/issues/3559
  it(`should preserve resolution dependencies when installing in lockfileOnly mode`, async () => {
    const checkProject = (project: Project) => {
      expect([...project.storedDescriptors.values()]).toStrictEqual(expect.arrayContaining([
        expect.objectContaining({name: `foo`, range: `unbound:bar`}),
        expect.objectContaining({name: `foo`, range: `resdep:foo@unbound:bar`}),
      ]));

      for (const packages of [project.originalPackages, project.storedPackages]) {
        expect([...packages.values()]).toStrictEqual(expect.arrayContaining([
          expect.objectContaining({name: `foo`, reference: `unbound:bar`}),
          expect.objectContaining({name: `foo`, reference: `resdep:foo@unbound:bar`}),
        ]));
      }
    };

    await xfs.mktempPromise(async dir => {
      await xfs.writeJsonPromise(ppath.join(dir, Filename.manifest), {
        dependencies: {
          [`foo`]: `resdep:foo@unbound:bar`,
        },
      });

      // First we install the project; this will generate the lockfile yada yada
      {
        const configuration = await getConfiguration(dir);
        const {project} = await Project.find(configuration, dir);
        const cache = await Cache.find(configuration);

        await project.install({cache, report: new ThrowReport()});

        // Sanity check
        checkProject(project);
      }

      // Then we do it again, with a lockfileOnly install
      {
        const configuration = await getConfiguration(dir);
        const {project} = await Project.find(configuration, dir);

        await project.resolveEverything({
          lockfileOnly: true,
          report: new ThrowReport(),
        });

        checkProject(project);
      }
    });
  });

  it(`should recover from a corrupted install state`, async() => {
    await xfs.mktempPromise(async dir => {
      await xfs.writeJsonPromise(ppath.join(dir, Filename.manifest), {name: `foo`});
      await xfs.writeFilePromise(ppath.join(dir, Filename.lockfile), ``);

      const configuration = getConfiguration(dir);
      const {project} = await Project.find(configuration, dir);
      const cache = await Cache.find(configuration);

      await project.install({cache, report: new ThrowReport()});

      const statePath = configuration.get(`installStatePath`);
      await xfs.writeFilePromise(statePath, `invalid state`);

      await expect(project.restoreInstallState()).resolves.toBeUndefined();
    });
  });
});
